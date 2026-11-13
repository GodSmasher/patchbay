#!/usr/bin/env node
/**
 * Pull the official MCP Registry index and extract everything we need
 * for a dual-tier crawl (live metadata + source audit):
 *
 *   - canonical MCP URL (first streamable-http remote)
 *   - GitHub / GitLab repository URL when present
 *   - friendly name + version for provenance
 *
 * Output: bench/registry-index.json with one entry per unique server
 * name (latest version wins). Resume-safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/ingest-mcp-registry.ts
 *   npx tsx scripts/ingest-mcp-registry.ts --limit=500        # cap for testing
 *   npx tsx scripts/ingest-mcp-registry.ts --out=<path>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const REGISTRY = 'https://registry.modelcontextprotocol.io/v0/servers'
const PAGE_SIZE = 100
const USER_AGENT = 'patchbay-crawler/0.9.0 (+https://patchbay-mcp.dev/about-crawler)'

interface RegistryServer {
  name: string
  version?: string
  title?: string
  description?: string
  websiteUrl?: string
  remotes?: Array<{ type?: string; url?: string }>
  repository?: { url?: string; source?: string }
}

interface RegistryMeta {
  'io.modelcontextprotocol.registry/official'?: {
    status?: string
    isLatest?: boolean
    updatedAt?: string
    publishedAt?: string
  }
}

interface RegistryItem {
  server: RegistryServer
  _meta?: RegistryMeta
}

interface RegistryPage {
  servers: RegistryItem[]
  metadata?: { nextCursor?: string; count?: number }
}

export interface IndexEntry {
  name: string
  title?: string
  description?: string
  version?: string
  remoteUrl: string
  repositoryUrl?: string
  repositorySource?: string
  websiteUrl?: string
  status?: string
  isLatest?: boolean
  updatedAt?: string
}

async function fetchPage(cursor?: string): Promise<RegistryPage> {
  const url = new URL(REGISTRY)
  url.searchParams.set('limit', String(PAGE_SIZE))
  if (cursor) url.searchParams.set('cursor', cursor)
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } })
  if (!res.ok) throw new Error('Registry ' + url + ' returned HTTP ' + res.status)
  return (await res.json()) as RegistryPage
}

function pickLiveUrl(remotes?: Array<{ type?: string; url?: string }>): string | undefined {
  if (!remotes || !remotes.length) return undefined
  // Prefer streamable-http, then sse, then any https url.
  const byPreference = (t?: string): number => (t === 'streamable-http' ? 0 : t === 'sse' ? 1 : 2)
  const sorted = [...remotes].sort((a, b) => byPreference(a.type) - byPreference(b.type))
  for (const r of sorted) {
    if (typeof r.url === 'string' && /^https:\/\//i.test(r.url)) return r.url
  }
  return undefined
}

function mergeEntry(prev: IndexEntry | undefined, next: IndexEntry): IndexEntry {
  if (!prev) return next
  // Latest wins, else keep the more recent updatedAt.
  if (next.isLatest && !prev.isLatest) return next
  if (!next.isLatest && prev.isLatest) return prev
  if ((next.updatedAt ?? '') > (prev.updatedAt ?? '')) return next
  return prev
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const limitFlag = argv.find((a) => a.startsWith('--limit='))
  const limit = limitFlag ? Math.max(1, parseInt(limitFlag.split('=')[1] ?? '0', 10) || 0) : Infinity
  const outFlag = argv.find((a) => a.startsWith('--out='))
  const out = outFlag ? outFlag.split('=')[1]! : 'bench/registry-index.json'

  const byName = new Map<string, IndexEntry>()
  let cursor: string | undefined
  let fetched = 0
  let skipped = 0

  for (;;) {
    const page = await fetchPage(cursor)
    for (const item of page.servers) {
      fetched += 1
      const s = item.server
      const meta = item._meta?.['io.modelcontextprotocol.registry/official']
      const remoteUrl = pickLiveUrl(s.remotes)
      if (!remoteUrl) { skipped += 1; continue }
      const entry: IndexEntry = {
        name: s.name,
        title: s.title,
        description: s.description,
        version: s.version,
        remoteUrl,
        repositoryUrl: s.repository?.url,
        repositorySource: s.repository?.source,
        websiteUrl: s.websiteUrl,
        status: meta?.status,
        isLatest: meta?.isLatest,
        updatedAt: meta?.updatedAt,
      }
      byName.set(s.name, mergeEntry(byName.get(s.name), entry))
      if (byName.size >= limit) break
    }
    if (byName.size >= limit) break
    const nextCursor = page.metadata?.nextCursor
    if (!nextCursor) break
    cursor = nextCursor
    if (fetched % 500 === 0) process.stderr.write('fetched ' + fetched + ' items, unique ' + byName.size + '\n')
  }

  const entries = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  const withRepo = entries.filter((e) => e.repositoryUrl).length
  const summary = {
    capturedAt: new Date().toISOString(),
    totalFetched: fetched,
    totalSkippedNoRemote: skipped,
    uniqueServers: entries.length,
    withRepositoryUrl: withRepo,
    withoutRepositoryUrl: entries.length - withRepo,
    sourceRegistry: REGISTRY,
    entries,
  }

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(summary, null, 2), 'utf8')
  process.stderr.write(
    'wrote ' + entries.length + ' unique servers (' + withRepo + ' with repo url, ' +
    (entries.length - withRepo) + ' without) to ' + out + '\n',
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
