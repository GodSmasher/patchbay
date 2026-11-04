import { readFileSync, writeFileSync } from 'node:fs'
import { auditTarget } from '@patchbay-nebius/audit-core'
import type { AuditReport, Severity } from '@patchbay-nebius/audit-core'

const DEFAULT_TARGETS = [
  'https://mcp.deepwiki.com/mcp',
  'https://mcp.context7.com/mcp',
]

const CONCURRENCY = 8
const TIMEOUT_MS = 8000

async function main() {
  const argv = process.argv.slice(2)
  const outFlag = argv.find((a) => a.startsWith('--out='))
  const outPath = outFlag?.slice('--out='.length)
  const fileFlag = argv.find((a) => a.startsWith('--file='))
  const filePath = fileFlag?.slice('--file='.length)
  const urls = argv.filter((a) => !a.startsWith('--'))
  const fromFile = filePath
    ? readFileSync(filePath, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    : []
  const targets = [...fromFile, ...urls]
  const finalTargets = targets.length > 0 ? targets : DEFAULT_TARGETS

  console.log(`Scanning ${finalTargets.length} MCP server(s), concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms\n`)

  const results: Array<{ url: string; report?: AuditReport; error?: string }> = []
  const queue = [...finalTargets]
  const workers = Array.from({ length: Math.min(CONCURRENCY, finalTargets.length) }, async () => {
    while (queue.length > 0) {
      const url = queue.shift()!
      process.stdout.write(`  scanning ${url} ... `)
      const started = Date.now()
      try {
        const report = await auditTarget(url, { timeoutMs: TIMEOUT_MS })
        results.push({ url, report })
        console.log(`${report.findings.length} finding(s) in ${Date.now() - started}ms`)
      } catch (e) {
        results.push({ url, error: (e as Error).message })
        console.log(`error: ${(e as Error).message}`)
      }
    }
  })
  await Promise.all(workers)

  console.log('\n--- SUMMARY ---\n')
  const header = ['URL', 'reach', 'transport', 'authReq', 'tools', 'crit', 'high', 'med', 'low', 'info'].join(' | ')
  console.log(header)
  console.log('-'.repeat(header.length))

  const totals: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  let reachable = 0, authRequired = 0

  for (const r of results) {
    if (!r.report) { console.log(`${r.url} | ERROR | - | - | - | - | - | - | - | -`); continue }
    const remote = r.report.snapshot.remote
    const s = r.report.summary
    for (const sev of ['critical', 'high', 'medium', 'low', 'info'] as const) totals[sev] += s[sev]
    if (remote?.reachable) reachable++
    if (remote?.authRequired) authRequired++
    console.log([
      r.url,
      remote?.reachable ? 'y' : 'n',
      remote?.transport ?? '-',
      remote?.authRequired ? 'y' : 'n',
      remote?.tools.length ?? 0,
      s.critical, s.high, s.medium, s.low, s.info,
    ].join(' | '))
  }

  console.log('')
  console.log(`Reachable: ${reachable}/${results.length}`)
  console.log(`Auth required: ${authRequired}/${results.length}`)
  console.log(`Totals: ${totals.critical} crit, ${totals.high} high, ${totals.medium} med, ${totals.low} low, ${totals.info} info`)

  const checkCounts: Record<string, number> = {}
  for (const r of results) {
    if (!r.report) continue
    for (const f of r.report.findings) checkCounts[f.id] = (checkCounts[f.id] ?? 0) + 1
  }
  console.log('\nFinding breakdown:')
  for (const [id, n] of Object.entries(checkCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id}: ${n}`)
  }

  if (outPath) {
    const payload = {
      capturedAt: new Date().toISOString(),
      targets: finalTargets,
      totals,
      checkCounts,
      results: results.map((r) => ({
        url: r.url,
        error: r.error,
        findings: r.report?.findings.map((f) => ({ id: f.id, severity: f.severity, confidence: f.confidence, title: f.title })) ?? [],
        remote: r.report?.snapshot.remote && {
          reachable: r.report.snapshot.remote.reachable,
          transport: r.report.snapshot.remote.transport,
          authRequired: r.report.snapshot.remote.authRequired,
          toolCount: r.report.snapshot.remote.tools.length,
          effectiveEndpoint: r.report.snapshot.remote.effectiveEndpoint,
        },
      })),
    }
    writeFileSync(outPath, JSON.stringify(payload, null, 2))
    console.log(`\nWritten: ${outPath}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
