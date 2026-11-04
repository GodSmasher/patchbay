#!/usr/bin/env node --experimental-strip-types
/**
 * Diff two patchbay sweep JSON files and surface every tool-manifest
 * change that happened between them. Lets us answer "how dynamic is the
 * MCP ecosystem?" and feeds the Friday blog post.
 *
 * Usage:
 *   node --experimental-strip-types scripts/manifest-change-rate.ts \
 *     bench/mcp-sweep-2026-11-04-big.json \
 *     bench/mcp-sweep-2026-11-05-big.json \
 *     [--out=bench/manifest-changes-2026-11-04-to-05.json]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { hashManifest, type ToolDescriptor } from '@patchbay-nebius/audit-core'

interface SweepEntry {
  url: string
  report?: {
    snapshot?: {
      remote?: {
        toolsListOk?: boolean
        tools?: ToolDescriptor[]
      }
    }
  }
  error?: string
}

interface Diff {
  url: string
  prevHash: string
  curHash: string
  prevTools: string[]
  curTools: string[]
  added: string[]
  removed: string[]
  descriptionChanged: string[]
  schemaChanged: string[]
}

function tools(entry: SweepEntry): ToolDescriptor[] {
  return entry.report?.snapshot?.remote?.tools ?? []
}

function diffEntries(prev: SweepEntry, cur: SweepEntry): Diff | null {
  const prevTools = tools(prev)
  const curTools = tools(cur)
  if (!prevTools.length && !curTools.length) return null

  const prevHash = hashManifest(prevTools)
  const curHash = hashManifest(curTools)
  if (prevHash === curHash) return null

  const prevByName = new Map(prevTools.map((t) => [t.name, t]))
  const curByName = new Map(curTools.map((t) => [t.name, t]))

  const added = [...curByName.keys()].filter((n) => !prevByName.has(n))
  const removed = [...prevByName.keys()].filter((n) => !curByName.has(n))
  const descriptionChanged: string[] = []
  const schemaChanged: string[] = []

  for (const [name, cur] of curByName.entries()) {
    const prev = prevByName.get(name)
    if (!prev) continue
    if ((prev.description ?? '').trim() !== (cur.description ?? '').trim()) descriptionChanged.push(name)
    if (JSON.stringify(prev.inputSchema ?? null) !== JSON.stringify(cur.inputSchema ?? null)) schemaChanged.push(name)
  }

  return {
    url: cur.url,
    prevHash,
    curHash,
    prevTools: prevTools.map((t) => t.name),
    curTools: curTools.map((t) => t.name),
    added,
    removed,
    descriptionChanged,
    schemaChanged,
  }
}

function main() {
  const args = process.argv.slice(2)
  const positional = args.filter((a) => !a.startsWith('--'))
  if (positional.length < 2) {
    console.error('Usage: manifest-change-rate.ts <prev.json> <cur.json> [--out=changes.json]')
    process.exit(2)
  }
  const [prevPath, curPath] = positional
  const outFlag = args.find((a) => a.startsWith('--out='))
  const outPath = outFlag?.slice('--out='.length)

  const prev = (JSON.parse(readFileSync(prevPath!, 'utf8')) as { results?: SweepEntry[] }).results ?? JSON.parse(readFileSync(prevPath!, 'utf8')) as SweepEntry[]
  const cur = (JSON.parse(readFileSync(curPath!, 'utf8')) as { results?: SweepEntry[] }).results ?? JSON.parse(readFileSync(curPath!, 'utf8')) as SweepEntry[]

  const prevMap = new Map(prev.map((e: SweepEntry) => [e.url, e]))
  const diffs: Diff[] = []

  for (const c of cur as SweepEntry[]) {
    const p = prevMap.get(c.url)
    if (!p) continue
    const d = diffEntries(p, c)
    if (d) diffs.push(d)
  }

  console.log(`\nCompared ${prev.length} prev vs ${cur.length} cur entries.`)
  console.log(`${diffs.length} servers changed their tool manifest.\n`)

  for (const d of diffs) {
    console.log('--- ' + d.url)
    if (d.added.length) console.log('  + added: ' + d.added.join(', '))
    if (d.removed.length) console.log('  - removed: ' + d.removed.join(', '))
    if (d.descriptionChanged.length) console.log('  ~ description-changed: ' + d.descriptionChanged.join(', '))
    if (d.schemaChanged.length) console.log('  ~ schema-changed: ' + d.schemaChanged.join(', '))
  }

  console.log('\nSummary:')
  console.log(`  ${diffs.filter((d) => d.added.length).length} added tools`)
  console.log(`  ${diffs.filter((d) => d.removed.length).length} removed tools`)
  console.log(`  ${diffs.filter((d) => d.descriptionChanged.length).length} description-only changes`)
  console.log(`  ${diffs.filter((d) => d.schemaChanged.length).length} schema changes`)

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(diffs, null, 2), 'utf8')
    console.log(`\nWritten: ${outPath}`)
  }
}

main()
