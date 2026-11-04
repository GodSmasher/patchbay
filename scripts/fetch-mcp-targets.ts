#!/usr/bin/env node --experimental-strip-types
/**
 * Pulls the top N MCP servers (by use count) from the Smithery registry,
 * extracts their HTTP deployment URL, combines with the manually curated
 * list in bench/mcp-sweep-targets.txt, deduplicates, and writes the
 * result to bench/mcp-sweep-targets-big.txt.
 *
 * Usage:
 *   node --experimental-strip-types scripts/fetch-mcp-targets.ts [--limit=100]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const EXISTING = resolve(ROOT, 'bench/mcp-sweep-targets.txt')
const OUT = resolve(ROOT, 'bench/mcp-sweep-targets-big.txt')

const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice('--limit='.length) ?? '100')

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
  console.log(`Fetching top ${limit} servers from Smithery...`)
  const all: SmitheryListItem[] = []
  const pageSize = 50
  const pages = Math.ceil(limit / pageSize)
  for (let p = 1; p <= pages; p++) {
    const batch = await fetchList(p, pageSize)
    all.push(...batch)
    if (batch.length < pageSize) break
  }
  console.log(`Got ${all.length} servers from registry.`)

  const remotes = all.filter((s) => s.remote && !s.inactive).slice(0, limit)
  console.log(`${remotes.length} are remote + active. Fetching deployment URLs...`)

  const urls = new Set<string>()
  let got = 0
  for (const s of remotes) {
    const detail = await fetchDetail(s.qualifiedName)
    if (!detail) continue
    const dep = detail.deploymentUrl ?? detail.connections?.find((c) => c.deploymentUrl)?.deploymentUrl
    if (!dep) continue
    try {
      urls.add(normaliseEndpoint(dep))
      got++
    } catch {
      // bad URL
    }
    // light rate limit
    await new Promise((r) => setTimeout(r, 50))
  }
  console.log(`Extracted ${got} unique deployment URLs from Smithery.`)

  // Merge with the existing manually curated list
  if (existsSync(EXISTING)) {
    const existing = readFileSync(EXISTING, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    for (const l of existing) urls.add(l)
    console.log(`Merged with ${existing.length} entries from ${EXISTING}.`)
  }

  const sorted = [...urls].sort()
  writeFileSync(OUT, sorted.join('\n') + '\n', 'utf8')
  console.log(`\nWrote ${sorted.length} URLs to ${OUT}.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
