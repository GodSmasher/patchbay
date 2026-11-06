#!/usr/bin/env node --experimental-strip-types
/**
 * Verify the "N of 145 publish a security.txt" blog claim.
 * Hits /.well-known/security.txt and /security.txt on each unique host
 * in bench/mcp-sweep-targets-big.txt.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const TARGETS_FILE = process.argv.find((a) => a.startsWith('--file='))?.slice('--file='.length) ?? 'bench/mcp-sweep-targets-big.txt'
const TARGETS = readFileSync(TARGETS_FILE, 'utf8')
  .split('\n').map((l) => l.trim()).filter(Boolean)
console.log(`Source: ${TARGETS_FILE} (${TARGETS.length} URLs)`)

const hosts = [...new Set(TARGETS.map((u) => {
  try { return new URL(u).origin } catch { return null }
}).filter(Boolean) as string[])]

console.log(`Checking ${hosts.length} unique hosts for security.txt...`)

const found: string[] = []
const notFound: string[] = []
const errors: Array<{ host: string; error: string }> = []
let done = 0

async function check(host: string) {
  for (const path of ['/.well-known/security.txt', '/security.txt']) {
    try {
      const r = await fetch(host + path, {
        method: 'GET',
        signal: AbortSignal.timeout(6000),
        redirect: 'follow',
      })
      if (r.ok) {
        const body = await r.text()
        if (body.toLowerCase().includes('contact:') || body.toLowerCase().includes('contact :')) {
          found.push(`${host}${path}`)
          return
        }
      }
    } catch (e) {
      errors.push({ host, error: (e as Error).message })
      return
    }
  }
  notFound.push(host)
}

const CONCURRENCY = 10
const queue = [...hosts]
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const h = queue.shift()!
    await check(h)
    done++
    if (done % 20 === 0) process.stdout.write(`  ${done}/${hosts.length}\n`)
  }
})
await Promise.all(workers)

console.log(`\n=== RESULTS ===`)
console.log(`Hosts checked:     ${hosts.length}`)
console.log(`security.txt FOUND: ${found.length}`)
console.log(`Not found:          ${notFound.length}`)
console.log(`Errors:             ${errors.length}`)

if (found.length) {
  console.log(`\nFound at:`)
  for (const f of found) console.log(`  + ${f}`)
}

const out = {
  capturedAt: new Date().toISOString(),
  totalTargetsInSweep: TARGETS.length,
  uniqueHostsChecked: hosts.length,
  securityTxtFound: found.length,
  securityTxtNotFound: notFound.length,
  errors: errors.length,
  foundAt: found,
}
const today = new Date().toISOString().slice(0, 10)
const outPath = `bench/security-txt-check-${today}.json`
writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log(`\nWritten: ${outPath}`)
