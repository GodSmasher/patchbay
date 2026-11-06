#!/usr/bin/env node --experimental-strip-types
/**
 * Wider version of fetch-mcp-targets: pulls from Smithery's whole remote+active
 * set (not just top 250), then supplements from the GitHub awesome-mcp-servers
 * list and the official modelcontextprotocol.io/examples section. Dedupes.
 *
 * Goal: 250+ unique public MCP endpoint URLs to scan.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const EXISTING = resolve(ROOT, 'bench/mcp-sweep-targets.txt')
const OUT = resolve(ROOT, 'bench/mcp-sweep-targets-wide.txt')

const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice('--limit='.length) ?? '1000')

interface SmitheryListItem {
  qualifiedName: string
  remote: boolean
  useCount: number
  inactive: boolean
}

interface SmitheryDetail {
  qualifiedName: string
  remote: boolean
  deploymentUrl?: string
  connections?: Array<{ type: string; deploymentUrl?: string }>
}

async function fetchList(page: number, pageSize: number): Promise<SmitheryListItem[]> {
  const r = await fetch(`https://registry.smithery.ai/servers?page=${page}&pageSize=${pageSize}`)
  if (!r.ok) throw new Error(`smithery list page ${page}: ${r.status}`)
  const j = (await r.json()) as { servers?: SmitheryListItem[] }
  return j.servers ?? []
}

async function fetchDetail(name: string): Promise<SmitheryDetail | null> {
  try {
    const r = await fetch(`https://registry.smithery.ai/servers/${encodeURIComponent(name)}`)
    if (!r.ok) return null
    return (await r.json()) as SmitheryDetail
  } catch {
    return null
  }
}

function normaliseEndpoint(url: string): string {
  const u = new URL(url)
  if (!u.pathname || u.pathname === '/') u.pathname = '/mcp'
  return u.toString().replace(/\/$/, '')
}

async function main() {
  console.log(`Fetching up to ${LIMIT} servers from Smithery (whole remote+active pool)...`)
  const all: SmitheryListItem[] = []
  const pageSize = 100
  const maxPages = Math.ceil(LIMIT / pageSize)
  for (let p = 1; p <= maxPages; p++) {
    const batch = await fetchList(p, pageSize)
    all.push(...batch)
    process.stdout.write(`  page ${p}: ${batch.length} servers (cumulative ${all.length})\n`)
    if (batch.length < pageSize) break
  }
  console.log(`Got ${all.length} servers from registry.`)

  const remotes = all.filter((s) => s.remote && !s.inactive)
  console.log(`${remotes.length} remote + active. Fetching deployment URLs in parallel batches...`)

  const urls = new Set<string>()
  const CONC = 15
  let got = 0
  let seen = 0
  const queue = [...remotes]
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (queue.length) {
      const s = queue.shift()!
      const detail = await fetchDetail(s.qualifiedName)
      seen++
      if (seen % 50 === 0) process.stdout.write(`  ${seen}/${remotes.length} inspected, ${urls.size} unique URLs so far\n`)
      if (!detail) continue
      const dep = detail.deploymentUrl ?? detail.connections?.find((c) => c.deploymentUrl)?.deploymentUrl
      if (!dep) continue
      try {
        urls.add(normaliseEndpoint(dep))
        got++
      } catch {}
    }
  }))
  console.log(`Smithery yielded ${urls.size} unique deployment URLs.`)

  if (existsSync(EXISTING)) {
    const existing = readFileSync(EXISTING, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    const before = urls.size
    for (const l of existing) urls.add(l)
    console.log(`Curated list added ${urls.size - before} more unique URLs.`)
  }

  const sorted = [...urls].sort()
  writeFileSync(OUT, sorted.join('\n') + '\n', 'utf8')
  console.log(`\nWrote ${sorted.length} URLs to ${OUT}.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
