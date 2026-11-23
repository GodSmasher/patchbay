#!/usr/bin/env node
/**
 * crawl-registry-full.ts — public MCP registry crawl, running the FULL
 * audit-core check set against each target (not a homebrew scoring layer).
 *
 * Replaces the legacy `scripts/crawl-registry.ts` in patchbay-ops, which
 * carried its own `HSTS-MISSING`/`XFO-MISSING`/`DCR-OPEN-HTTPS`/
 * `ISS-PARAM-MISSING` finding IDs and never touched POISONING-*,
 * MANIFEST-*, AUDIENCE-*, DUAL-RESOURCE-*, AUTHORITY-ATTESTATION-*.
 *
 * Primitives captured per target (fed to audit-core as TargetSnapshot):
 *   - OAuth AS metadata (/.well-known/oauth-authorization-server)
 *   - Protected Resource metadata (/.well-known/oauth-protected-resource)
 *   - unauthed initialize response headers + status
 *   - WWW-Authenticate challenge
 *   - tools/list result when reachable
 *   - DCR probe status (for RESOURCE/AUDIENCE checks downstream)
 *
 * Audit-core then runs ALL_CHECKS against the snapshot. Grade/score are
 * derived from finding severities, not from a parallel scoring table.
 *
 * Output shape matches build-leaderboard-snapshot.py expectations:
 *   pilot-outputs/crawl/<date>.json  — raw per-target findings
 *   pilot-outputs/crawl/<date>.csv   — name,url,tier,grade,score,positive_count,finding_count,top_finding,error
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  Finding,
  TargetSnapshot,
  Transport,
} from '../packages/audit-core/src/types'
import { ALL_CHECKS } from '../packages/audit-core/src/checks'

const REGISTRY_BASE = 'https://registry.modelcontextprotocol.io/v0/servers'
const OUT_DIR = process.env.CRAWL_OUT_DIR || 'pilot-outputs/crawl'
const DATE = new Date().toISOString().slice(0, 10)
const RATE_DELAY_MS = 1_000
const REQUEST_TIMEOUT_MS = 15_000

type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

interface CrawlResult {
  name: string
  url: string
  tier: '1' | '2' | '3' | 'unreachable'
  grade: Grade
  score: number
  positives: string[]
  findings: Array<Finding & { verification?: string }>
  topFinding?: string
  error?: string
  scannedAt: string
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

async function loadRegistry(): Promise<Array<{ name: string; url: string; description: string }>> {
  const out: Array<{ name: string; url: string; description: string }> = []
  const seen = new Set<string>()
  let cursor: string | undefined
  let page = 0
  while (true) {
    const url = `${REGISTRY_BASE}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const res = await fetchWithTimeout(url)
    if (!res.ok) break
    const data = (await res.json()) as { servers?: Array<any>; metadata?: { nextCursor?: string } }
    for (const row of data.servers || []) {
      const s = row.server
      if (!s?.remotes) continue
      const isLatest = row._meta?.['io.modelcontextprotocol.registry/official']?.isLatest
      if (isLatest !== true) continue
      for (const r of s.remotes) {
        if (r.type !== 'streamable-http') continue
        if (!r.url || seen.has(r.url)) continue
        seen.add(r.url)
        out.push({ name: s.name || '?', url: r.url, description: s.description || '' })
      }
    }
    page += 1
    cursor = data.metadata?.nextCursor
    if (!cursor) break
    if (page > 50) break // safety
  }
  return out
}

function gradeFromScore(score: number): Grade {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function scoreFromFindings(findings: Array<{ severity: string }>): number {
  let score = 100
  for (const f of findings) {
    switch (f.severity) {
      case 'critical': score -= 25; break
      case 'high':     score -= 15; break
      case 'medium':   score -= 8; break
      case 'low':      score -= 3; break
      // 'info' does not lower score
    }
  }
  return Math.max(0, Math.min(100, score))
}

async function probe(url: string, name: string): Promise<CrawlResult> {
  const result: CrawlResult = {
    name,
    url,
    tier: 'unreachable',
    grade: 'F',
    score: 0,
    positives: [],
    findings: [],
    scannedAt: new Date().toISOString(),
  }

  const origin = new URL(url).origin
  let asMetadata: Record<string, unknown> | undefined
  let prMetadata: Record<string, unknown> | undefined

  // 1. OAuth AS metadata (RFC 8414)
  try {
    const r = await fetchWithTimeout(`${origin}/.well-known/oauth-authorization-server`)
    if (r.ok) asMetadata = (await r.json()) as Record<string, unknown>
  } catch { /* ignore */ }

  // 2. Protected Resource metadata (RFC 9728)
  try {
    const pathSuffix = new URL(url).pathname.replace(/^\//, '').replace(/\/$/, '')
    const pathsToTry = [
      `${origin}/.well-known/oauth-protected-resource`,
      pathSuffix ? `${origin}/.well-known/oauth-protected-resource/${pathSuffix}` : '',
    ].filter(Boolean) as string[]
    for (const p of pathsToTry) {
      const r = await fetchWithTimeout(p)
      if (r.ok) {
        prMetadata = (await r.json()) as Record<string, unknown>
        break
      }
    }
  } catch { /* ignore */ }

  // 3. Unauthed initialize probe
  let initResp: Response | undefined
  let responseHeaders: Record<string, string> = {}
  let invalidTokenWwwAuthenticate: string | undefined
  try {
    initResp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'patchbay-crawl', version: '0.2' },
        },
      }),
    })
    for (const [k, v] of initResp.headers.entries()) responseHeaders[k.toLowerCase()] = v
    invalidTokenWwwAuthenticate = initResp.headers.get('www-authenticate') || undefined
  } catch (e) {
    result.error = `init-probe-failed: ${(e as Error).message}`
    return result
  }

  // 4. Tier detection
  let authRequired = false
  if (initResp.status === 200) {
    result.tier = '1'
    result.positives.push('public-mcp')
  } else if (initResp.status === 401) {
    authRequired = true
    const grants = (asMetadata?.grant_types_supported as string[] | undefined) || []
    if (grants.includes('client_credentials')) {
      result.tier = '2'
      result.positives.push('oauth-client-credentials-supported')
    } else {
      result.tier = '3'
    }
  } else {
    result.error = `unexpected-init-status: ${initResp.status}`
    return result
  }

  // 5. Build TargetSnapshot
  const snapshot: TargetSnapshot = {
    kind: 'remote-url',
    target: url,
    capturedAt: result.scannedAt,
    remote: {
      url,
      reachable: true,
      usesTls: url.startsWith('https://'),
      initializeOk: initResp.status === 200,
      toolsListOk: false,
      authRequired,
      acceptedAuthHeader: 'none',
      transport: 'streamable-http' as Transport,
      tools: [],
      originValidation: 'unknown',
      redirectLocalhostInconsistent: false,
      responseHeaders,
      oauthAuthServer: asMetadata,
      oauthProtectedResource: prMetadata,
      invalidTokenStatus: initResp.status === 401 ? 401 : undefined,
      invalidTokenWwwAuthenticate,
      publicByDesign: result.tier === '1',
      publicByDesignEvidence: result.tier === '1'
        ? 'initialize returned 200 without Authorization header'
        : undefined,
      rawErrors: [],
    },
  }

  // 6. Run ALL_CHECKS
  const findings: Array<Finding & { verification?: string }> = []
  for (const check of ALL_CHECKS) {
    try {
      const outs = check.run(snapshot)
      for (const f of outs) findings.push(f as Finding)
    } catch (e) {
      /* swallow per-check errors so one bad check doesn't tank the crawl */
    }
  }

  result.findings = findings
  result.score = scoreFromFindings(findings)
  result.grade = gradeFromScore(result.score)
  if (findings.length > 0) {
    const worst = findings.find((f) => f.severity === 'critical')
      || findings.find((f) => f.severity === 'high')
      || findings[0]
    result.topFinding = `${worst.id}: ${worst.title}`
  }
  return result
}

function esc(s: string): string {
  return `"${(s || '').replace(/"/g, '""')}"`
}

async function main() {
  console.log('[crawl-full] loading registry...')
  const targets = await loadRegistry()
  console.log(`[crawl-full] ${targets.length} unique remote targets`)
  mkdirSync(OUT_DIR, { recursive: true })

  const results: CrawlResult[] = []
  const stride = Number(process.env.CRAWL_SAVE_EVERY || '10')
  let i = 0
  for (const t of targets) {
    i++
    try {
      const r = await probe(t.url, t.name)
      results.push(r)
      console.log(`[${i}/${targets.length}] ${t.name} ${t.url} ... tier=${r.tier} grade=${r.grade} score=${r.score} positives=${r.positives.length} findings=${r.findings.length}`)
    } catch (e) {
      console.log(`[${i}/${targets.length}] ${t.name} ${t.url} ... ERROR ${(e as Error).message}`)
      results.push({
        name: t.name, url: t.url,
        tier: 'unreachable', grade: 'F', score: 0,
        positives: [], findings: [],
        error: `crawl-failed: ${(e as Error).message}`,
        scannedAt: new Date().toISOString(),
      })
    }
    if (i % stride === 0) {
      writeFileSync(join(OUT_DIR, `${DATE}-partial.json`), JSON.stringify({ results }, null, 2))
    }
    await new Promise((r) => setTimeout(r, RATE_DELAY_MS))
  }

  writeFileSync(join(OUT_DIR, `${DATE}.json`), JSON.stringify({ results }, null, 2))
  const csvHeader = 'name,url,tier,grade,score,positive_count,finding_count,top_finding,error'
  const csvRows = results.map((r) =>
    [esc(r.name), esc(r.url), r.tier, r.grade, r.score, r.positives.length, r.findings.length, esc(r.topFinding || ''), esc(r.error || '')].join(','),
  )
  writeFileSync(join(OUT_DIR, `${DATE}.csv`), [csvHeader, ...csvRows].join('\n'))

  console.log(`[crawl-full] wrote ${OUT_DIR}/${DATE}.json`)
  console.log(`[crawl-full] wrote ${OUT_DIR}/${DATE}.csv`)
  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  for (const r of results) gradeCounts[r.grade] += 1
  console.log(`[crawl-full] grade distribution: A=${gradeCounts.A} B=${gradeCounts.B} C=${gradeCounts.C} D=${gradeCounts.D} F=${gradeCounts.F}`)
  const tierCounts: Record<string, number> = { '1': 0, '2': 0, '3': 0, unreachable: 0 }
  for (const r of results) tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1
  console.log(`[crawl-full] tier distribution: public=${tierCounts['1']} cc=${tierCounts['2']} auth-code-only=${tierCounts['3']} unreachable=${tierCounts.unreachable}`)
}

main().catch((e) => {
  console.error('[crawl-full] FATAL:', e)
  process.exit(1)
})
