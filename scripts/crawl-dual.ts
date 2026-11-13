#!/usr/bin/env node
/**
 * Dual-tier crawler for the MCP leaderboard.
 *
 * Reads bench/registry-index.json (produced by ingest-mcp-registry.ts),
 * and for each unique server runs up to two tiers in parallel:
 *
 *   TIER A — live metadata only (opts.metadataOnly, no tools/list)
 *            Reads /.well-known/oauth-* and response headers. Catches
 *            AUTH-003, AUTH-005, RESOURCE-001, ISS-001, HEADERS-001,
 *            TRANSPORT-001/002, PKCE metadata posture.
 *
 *   TIER B — static source audit (directory mode)
 *            Shallow-clones the repository.url into a temp dir, runs the
 *            audit-core directory probe, deletes the clone. Catches
 *            SECRET-*, source-level POISONING-001, source-level SCOPE,
 *            MANIFEST shape when a tools definition exists in the repo.
 *
 * Findings from both tiers are merged with provenance tags. Result per
 * host is written to disk as it completes so the crawl is resumable:
 * a mid-run failure leaves the first N hosts' JSONs on disk and the
 * next invocation only runs the hosts without a result file.
 *
 * Operational guard-rails: 2 req/s per host, N concurrent hosts (default
 * 8), 30s per-tier timeout, User-Agent identifies the crawler and the
 * about-crawler page. NO authenticated requests, no DCR, no crafted
 * /authorize against third-party hosts.
 *
 * Usage:
 *   npx tsx scripts/crawl-dual.ts
 *   npx tsx scripts/crawl-dual.ts --index=bench/registry-index.json --out=bench/crawl-dual/
 *   npx tsx scripts/crawl-dual.ts --limit=200 --concurrency=4
 *   npx tsx scripts/crawl-dual.ts --skip-source       # Tier A only, no clones
 *   npx tsx scripts/crawl-dual.ts --only=ac.inference.sh/mcp
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { auditTarget, type AuditReport, type Finding } from '@patchbay-nebius/audit-core'
import type { IndexEntry } from './ingest-mcp-registry'

const USER_AGENT = 'patchbay-crawler/0.9.0 (+https://patchbay-mcp.dev/about-crawler)'
const DEFAULT_CONCURRENCY = 8
const PER_TIER_TIMEOUT_MS = 30_000
const CLONE_ROOT = join(tmpdir(), 'patchbay-crawl')

interface IndexFile { entries: IndexEntry[] }

interface CrawlResult {
  name: string
  remoteUrl: string
  repositoryUrl?: string
  capturedAt: string
  liveTier?: { ok: boolean; findings: Finding[]; durationMs: number; error?: string; summary: AuditReport['summary'] }
  sourceTier?: { ok: boolean; findings: Finding[]; durationMs: number; error?: string; summary: AuditReport['summary'] }
  mergedFindings: (Finding & { source: 'live' | 'source' })[]
  scanSource: 'live-metadata+source' | 'live-metadata' | 'source' | 'unreachable'
}

function parseArgs(argv: string[]): {
  index: string; outDir: string; limit: number; concurrency: number;
  skipSource: boolean; skipLive: boolean; only?: string; resume: boolean;
} {
  const get = (f: string, dflt?: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(f + '='))
    return hit ? hit.slice(f.length + 1) : dflt
  }
  return {
    index: get('--index', 'bench/registry-index.json')!,
    outDir: get('--out', 'bench/crawl-dual')!,
    limit: Number(get('--limit', String(Infinity))!),
    concurrency: Number(get('--concurrency', String(DEFAULT_CONCURRENCY))!),
    skipSource: argv.includes('--skip-source'),
    skipLive: argv.includes('--skip-live'),
    only: get('--only'),
    resume: !argv.includes('--no-resume'),
  }
}

function slugFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label + ' timed out after ' + ms + 'ms')), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

async function runLiveTier(entry: IndexEntry): Promise<CrawlResult['liveTier']> {
  const start = Date.now()
  try {
    const report = await withTimeout(
      auditTarget(entry.remoteUrl, { metadataOnly: true, timeoutMs: 8000 }),
      PER_TIER_TIMEOUT_MS, 'live tier',
    )
    return { ok: true, findings: report.findings, durationMs: Date.now() - start, summary: report.summary }
  } catch (e) {
    return { ok: false, findings: [], durationMs: Date.now() - start, error: (e as Error).message, summary: { critical:0, high:0, medium:0, low:0, info:0 } }
  }
}

async function cloneShallow(repoUrl: string, dst: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn('git', ['clone', '--depth=1', '--filter=blob:none', '--single-branch', '--quiet', repoUrl, dst], {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'true', GIT_USER_AGENT: USER_AGENT },
    })
    let stderr = ''
    p.stderr?.on('data', (d) => { stderr += d.toString() })
    const killTimer = setTimeout(() => p.kill('SIGKILL'), 45_000)
    p.on('close', (code) => {
      clearTimeout(killTimer)
      if (code === 0) resolve()
      else reject(new Error('git clone exit ' + code + (stderr ? ': ' + stderr.slice(0, 300) : '')))
    })
  })
}

async function runSourceTier(entry: IndexEntry): Promise<CrawlResult['sourceTier']> {
  if (!entry.repositoryUrl) return undefined
  const start = Date.now()
  const dst = join(CLONE_ROOT, slugFor(entry.name) + '-' + Date.now().toString(36))
  try {
    mkdirSync(CLONE_ROOT, { recursive: true })
    await withTimeout(cloneShallow(entry.repositoryUrl, dst), 60_000, 'git clone')
    const report = await withTimeout(auditTarget(dst, { timeoutMs: 15000 }), PER_TIER_TIMEOUT_MS, 'source tier')
    return { ok: true, findings: report.findings, durationMs: Date.now() - start, summary: report.summary }
  } catch (e) {
    return { ok: false, findings: [], durationMs: Date.now() - start, error: (e as Error).message, summary: { critical:0, high:0, medium:0, low:0, info:0 } }
  } finally {
    try { rmSync(dst, { recursive: true, force: true }) } catch { /* best-effort */ }
  }
}

function mergeFindings(live?: CrawlResult['liveTier'], source?: CrawlResult['sourceTier']): CrawlResult['mergedFindings'] {
  const out: CrawlResult['mergedFindings'] = []
  if (live?.ok) for (const f of live.findings) out.push({ ...f, source: 'live' })
  if (source?.ok) for (const f of source.findings) out.push({ ...f, source: 'source' })
  return out
}

function classifyScanSource(live?: CrawlResult['liveTier'], source?: CrawlResult['sourceTier']): CrawlResult['scanSource'] {
  const l = Boolean(live?.ok)
  const s = Boolean(source?.ok)
  if (l && s) return 'live-metadata+source'
  if (l) return 'live-metadata'
  if (s) return 'source'
  return 'unreachable'
}

async function runOne(entry: IndexEntry, opts: { skipSource: boolean; skipLive: boolean }): Promise<CrawlResult> {
  const [liveTier, sourceTier] = await Promise.all([
    opts.skipLive ? Promise.resolve(undefined) : runLiveTier(entry),
    opts.skipSource ? Promise.resolve(undefined) : runSourceTier(entry),
  ])
  return {
    name: entry.name,
    remoteUrl: entry.remoteUrl,
    repositoryUrl: entry.repositoryUrl,
    capturedAt: new Date().toISOString(),
    liveTier,
    sourceTier,
    mergedFindings: mergeFindings(liveTier, sourceTier),
    scanSource: classifyScanSource(liveTier, sourceTier),
  }
}

async function main(): Promise<void> {
  // UA override for fetch() calls inside audit-core
  process.env.PATCHBAY_USER_AGENT = USER_AGENT

  const args = parseArgs(process.argv.slice(2))
  const indexFile = JSON.parse(readFileSync(args.index, 'utf8')) as IndexFile
  let entries = indexFile.entries
  if (args.only) entries = entries.filter((e) => e.name === args.only)
  if (Number.isFinite(args.limit)) entries = entries.slice(0, args.limit)

  mkdirSync(args.outDir, { recursive: true })

  // Resume: skip entries whose result file already exists.
  const pending = args.resume
    ? entries.filter((e) => !existsSync(join(args.outDir, slugFor(e.name) + '.json')))
    : entries

  process.stderr.write('crawling ' + pending.length + ' / ' + entries.length + ' server(s), concurrency=' + args.concurrency + '\n')

  let done = 0
  let failed = 0
  const startedAt = Date.now()

  async function worker(): Promise<void> {
    for (;;) {
      const entry = pending.shift()
      if (!entry) return
      try {
        const result = await runOne(entry, { skipSource: args.skipSource, skipLive: args.skipLive })
        writeFileSync(join(args.outDir, slugFor(entry.name) + '.json'), JSON.stringify(result, null, 2), 'utf8')
        done += 1
        if (done % 25 === 0) {
          const elapsedS = Math.round((Date.now() - startedAt) / 1000)
          process.stderr.write('[' + done + '/' + (done + pending.length + failed) + '] ' + elapsedS + 's elapsed · last: ' + entry.name + ' (' + result.scanSource + ')\n')
        }
      } catch (e) {
        failed += 1
        process.stderr.write('FAIL ' + entry.name + ' — ' + (e as Error).message + '\n')
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, args.concurrency) }, () => worker())
  await Promise.all(workers)

  process.stderr.write('done: ' + done + ' crawled, ' + failed + ' failed, in ' + Math.round((Date.now() - startedAt) / 1000) + 's\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
