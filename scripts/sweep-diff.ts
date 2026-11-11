#!/usr/bin/env node
/**
 * Diff two mcp-sweep JSON files on the intersection of their targets.
 * Reports grade shifts, new/gone findings per host, and aggregate counts
 * restricted to the shared cohort so "one week later" claims stay honest.
 */
import { readFileSync, writeFileSync } from 'node:fs'

interface Finding { id: string; severity: string; title: string }
interface Result { url: string; findings?: Finding[]; remote?: { reachable?: boolean } }
interface Sweep { capturedAt?: string; targets?: string[]; results?: Result[]; checkCounts?: Record<string, number> }

const [, , prevPath, nextPath, outPath] = process.argv
if (!prevPath || !nextPath) {
  console.error('usage: sweep-diff.ts <prev.json> <next.json> [out.json]')
  process.exit(2)
}

const prev = JSON.parse(readFileSync(prevPath, 'utf8')) as Sweep
const next = JSON.parse(readFileSync(nextPath, 'utf8')) as Sweep

const byUrl = (sweep: Sweep): Map<string, Result> => new Map((sweep.results ?? []).map((r) => [r.url, r]))
const prevByUrl = byUrl(prev)
const nextByUrl = byUrl(next)

const intersection = [...prevByUrl.keys()].filter((u) => nextByUrl.has(u))
console.log(`prev targets: ${prev.targets?.length ?? prevByUrl.size}`)
console.log(`next targets: ${next.targets?.length ?? nextByUrl.size}`)
console.log(`intersection: ${intersection.length}`)
console.log('')

const sevOrder = ['critical', 'high', 'medium', 'low', 'info']
const emptyCounts = (): Record<string, number> => Object.fromEntries(sevOrder.map((s) => [s, 0]))
const sevCounts = (findings: Finding[] = []): Record<string, number> => {
  const c = emptyCounts()
  for (const f of findings) if (c[f.severity] !== undefined) c[f.severity]! += 1
  return c
}
const scoreFromCounts = (c: Record<string, number>): number => {
  const WEIGHTS: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3, info: 0 }
  let s = 100
  for (const sev of sevOrder) s -= (c[sev] ?? 0) * (WEIGHTS[sev] ?? 0)
  return Math.max(0, s)
}
const grade = (s: number): string => s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'F'

const checkDeltas: Record<string, { prev: number; next: number }> = {}
const prevTotals = emptyCounts()
const nextTotals = emptyCounts()
const hostChanges: Array<{ url: string; prevGrade: string; nextGrade: string; prevScore: number; nextScore: number; newFindingIds: string[]; goneFindingIds: string[] }> = []

for (const url of intersection) {
  const p = prevByUrl.get(url)!
  const n = nextByUrl.get(url)!
  const pFind = p.findings ?? []
  const nFind = n.findings ?? []

  for (const f of pFind) {
    checkDeltas[f.id] = checkDeltas[f.id] ?? { prev: 0, next: 0 }
    checkDeltas[f.id]!.prev += 1
    if (prevTotals[f.severity] !== undefined) prevTotals[f.severity]! += 1
  }
  for (const f of nFind) {
    checkDeltas[f.id] = checkDeltas[f.id] ?? { prev: 0, next: 0 }
    checkDeltas[f.id]!.next += 1
    if (nextTotals[f.severity] !== undefined) nextTotals[f.severity]! += 1
  }

  const pIds = new Set(pFind.map((f) => f.id))
  const nIds = new Set(nFind.map((f) => f.id))
  const newIds = [...nIds].filter((i) => !pIds.has(i))
  const goneIds = [...pIds].filter((i) => !nIds.has(i))

  const pc = sevCounts(pFind)
  const nc = sevCounts(nFind)
  const ps = scoreFromCounts(pc)
  const ns = scoreFromCounts(nc)
  const pg = grade(ps)
  const ng = grade(ns)

  if (pg !== ng || newIds.length > 0 || goneIds.length > 0) {
    hostChanges.push({ url, prevGrade: pg, nextGrade: ng, prevScore: ps, nextScore: ns, newFindingIds: newIds, goneFindingIds: goneIds })
  }
}

console.log('=== Intersection totals ===')
console.log('prev:', prevTotals)
console.log('next:', nextTotals)
console.log('')
console.log('=== Check deltas (intersection only) ===')
for (const [id, d] of Object.entries(checkDeltas).sort((a, b) => (b[1].next - b[1].prev) - (a[1].next - a[1].prev))) {
  if (d.prev === d.next) continue
  const delta = d.next - d.prev
  console.log(`  ${id.padEnd(16)} ${String(d.prev).padStart(4)} -> ${String(d.next).padStart(4)}  (${delta > 0 ? '+' : ''}${delta})`)
}
console.log('')
console.log('=== Hosts whose grade changed ===')
const gradeShifts = hostChanges.filter((c) => c.prevGrade !== c.nextGrade)
for (const c of gradeShifts) {
  console.log(`  ${c.url}: ${c.prevGrade}(${c.prevScore}) -> ${c.nextGrade}(${c.nextScore})  +[${c.newFindingIds.join(',')}]  -[${c.goneFindingIds.join(',')}]`)
}
console.log(`\nTotal hosts with any change: ${hostChanges.length}  (grade shift: ${gradeShifts.length})`)

if (outPath) {
  writeFileSync(outPath, JSON.stringify({
    prevPath, nextPath,
    prevCapturedAt: prev.capturedAt,
    nextCapturedAt: next.capturedAt,
    intersectionSize: intersection.length,
    prevTotals,
    nextTotals,
    checkDeltas,
    hostChanges,
  }, null, 2))
  console.log(`\nWritten: ${outPath}`)
}
