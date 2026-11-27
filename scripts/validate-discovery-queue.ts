#!/usr/bin/env tsx
/**
 * CI gate: validate that new entries in apps/web/data/discovery-queue.json
 * are actually MCP servers before merge.
 *
 * Fetches the queue from main (via git show) and compares to the local
 * branch's copy. For each NEW host, probes it with a strict MCP-protocol
 * check (JSON-RPC initialize must return `protocolVersion`, or 4xx body
 * must be JSON with a jsonrpc-ish marker).
 *
 * Fails the build if the false-positive rate exceeds the threshold below.
 * Runs over a stratified random sample (not every new host) to keep CI
 * latency bounded. For a PR adding N new hosts: samples min(N, SAMPLE_MAX).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface Entry { host: string; url: string; findings: Record<string, number>; topFindingIds?: string[] }
interface Queue { entries: Entry[] }

const QUEUE_PATH = join('apps', 'web', 'data', 'discovery-queue.json')
const SAMPLE_MAX = Number(process.env.VALIDATE_SAMPLE_MAX ?? '30')
const MAX_FP_RATE = Number(process.env.VALIDATE_MAX_FP_RATE ?? '0.15')
const BASE_REF = process.env.VALIDATE_BASE_REF ?? 'origin/main'
const PROBE_TIMEOUT_MS = 8000

function readMainQueue(): Queue {
  try {
    // execFileSync (no shell): BASE_REF comes from an env var, so arbitrary
    // characters in it must not reach a shell. git's `<ref>:<path>` treeish
    // syntax takes a single argv, so we build it, but it's never parsed by sh.
    const raw = execFileSync('git', ['show', `${BASE_REF}:${QUEUE_PATH}`], { encoding: 'utf8' })
    return JSON.parse(raw)
  } catch {
    // Base doesn't have the file yet → treat every local entry as new.
    return { entries: [] }
  }
}

async function probe(url: string): Promise<'verified-mcp' | 'reachable-not-mcp' | 'dead'> {
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'patchbay-validate', version: '0.1' } },
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        'user-agent': 'patchbay-validate-ci/0.1',
      },
      body,
      signal: controller.signal,
      redirect: 'manual',
    })
    const text = await res.text()
    const chunk = text.slice(0, 2048).toLowerCase()
    const jsonLooking = /^[\s]*[\[{]/.test(text)
    if (chunk.includes('protocolversion')) return 'verified-mcp'
    if ((res.status === 401 || res.status === 403) && jsonLooking) return 'verified-mcp'
    if (res.status >= 500 || res.status === 404) return 'dead'
    return 'reachable-not-mcp'
  } catch {
    return 'dead'
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  const local = JSON.parse(readFileSync(QUEUE_PATH, 'utf8')) as Queue
  const base = readMainQueue()
  const baseHosts = new Set(base.entries.map((e) => e.host.toLowerCase()))
  const newEntries = local.entries.filter((e) => !baseHosts.has(e.host.toLowerCase()))

  if (newEntries.length === 0) {
    console.log('[validate] no new entries in discovery-queue.json; OK')
    return 0
  }

  console.log(`[validate] ${newEntries.length} new entries vs ${BASE_REF}; sampling up to ${SAMPLE_MAX}`)

  // Stratified sample: proportionally from crit / high / medium / rest buckets.
  const by = { crit: [] as Entry[], high: [] as Entry[], med: [] as Entry[], rest: [] as Entry[] }
  for (const e of newEntries) {
    if (e.findings.critical > 0) by.crit.push(e)
    else if (e.findings.high > 0) by.high.push(e)
    else if (e.findings.medium > 0) by.med.push(e)
    else by.rest.push(e)
  }
  const pickShare = (arr: Entry[], share: number): Entry[] => {
    const n = Math.min(arr.length, Math.max(1, Math.round(SAMPLE_MAX * share)))
    const copy = [...arr]
    const picked: Entry[] = []
    for (let i = 0; i < n && copy.length > 0; i++) {
      picked.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]!)
    }
    return picked
  }
  const sample = [
    ...pickShare(by.crit, 0.35),
    ...pickShare(by.high, 0.30),
    ...pickShare(by.med, 0.25),
    ...pickShare(by.rest, 0.10),
  ].slice(0, SAMPLE_MAX)
  console.log(`[validate] stratified sample size: ${sample.length}`)

  const results = await Promise.all(sample.map(async (e) => ({ e, verdict: await probe(e.url) })))

  const fp = results.filter((r) => r.verdict !== 'verified-mcp')
  const fpRate = fp.length / Math.max(1, results.length)
  console.log(`[validate] results:`)
  for (const r of results) console.log(`  ${r.verdict.padEnd(22)} ${r.e.host}`)
  console.log(`[validate] false-positive rate: ${(fpRate * 100).toFixed(1)}% (${fp.length}/${results.length})`)
  console.log(`[validate] threshold: ${(MAX_FP_RATE * 100).toFixed(1)}%`)

  if (fpRate > MAX_FP_RATE) {
    console.error(`[validate] FAIL: false-positive rate ${(fpRate * 100).toFixed(1)}% exceeds threshold ${(MAX_FP_RATE * 100).toFixed(1)}%`)
    console.error('[validate] fix: re-probe the new entries with strict MCP check before adding them to the queue.')
    return 1
  }
  console.log('[validate] PASS')
  return 0
}

main().then((code) => process.exit(code)).catch((err) => { console.error(err); process.exit(2) })
