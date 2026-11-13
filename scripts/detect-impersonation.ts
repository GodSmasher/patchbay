#!/usr/bin/env node
/**
 * Impersonation / typosquatting detector for the MCP Registry.
 *
 * For every pair of registry entries whose canonical names are within
 * a small edit distance, flag the pair when the two entries look like
 * they come from DIFFERENT owners — different repository owner, different
 * live-URL host, no shared namespace prefix. Those are the signatures
 * of typosquats and bait-and-switch MCPs that existing scanners do not
 * catch.
 *
 * Also produces a "well-known targets at risk" section: any entry whose
 * name is a close match to a known-brand MCP (Linear, Notion, Supabase,
 * ...) but whose owner is not from the real company's org.
 *
 * Output: bench/impersonation-report.json + stdout summary.
 *
 * Usage:
 *   npx tsx scripts/detect-impersonation.ts
 *   npx tsx scripts/detect-impersonation.ts --index=bench/registry-index.json
 *   npx tsx scripts/detect-impersonation.ts --max-distance=2
 */
import { readFileSync, writeFileSync } from 'node:fs'

interface IndexEntry {
  name: string
  title?: string
  description?: string
  remoteUrl: string
  repositoryUrl?: string
  websiteUrl?: string
  isLatest?: boolean
}

interface IndexFile { entries: IndexEntry[] }

interface ImpersonationPair {
  nameA: string
  nameB: string
  normalisedA: string
  normalisedB: string
  editDistance: number
  signal: string  // which heuristic flagged this
  entryA: Pick<IndexEntry, 'name' | 'remoteUrl' | 'repositoryUrl' | 'description'>
  entryB: Pick<IndexEntry, 'name' | 'remoteUrl' | 'repositoryUrl' | 'description'>
}

interface WellKnownRisk {
  target: string            // the brand we're protecting
  candidate: Pick<IndexEntry, 'name' | 'remoteUrl' | 'repositoryUrl' | 'description'>
  editDistance: number
  signal: string
}

// Brands whose MCP server is high-value enough that a lookalike is
// worth flagging even against a single-entry comparison. Format:
//   canonicalBrand -> list of canonical tokens that appear in their
//   legitimate name OR the GitHub owner of the real repo
// canonicalHosts: hostnames (or hostname suffixes) owned by the brand.
// When the registry entry has no repositoryUrl set, the owner check
// alone cannot clear a legitimate first-party server (e.g. the real
// Notion server lives at mcp.notion.com with no makenotion/* repo in
// the registry metadata). Matching the remoteUrl host against the
// brand's canonical domain clears those first-party entries without
// weakening the typosquat signal.
const BRANDS: Record<string, { tokens: string[]; legitOwners: string[]; canonicalHosts: string[] }> = {
  linear:    { tokens: ['linear'],      legitOwners: ['linear'],                 canonicalHosts: ['linear.app'] },
  notion:    { tokens: ['notion'],      legitOwners: ['makenotion'],             canonicalHosts: ['notion.com', 'notion.so'] },
  supabase:  { tokens: ['supabase'],    legitOwners: ['supabase'],               canonicalHosts: ['supabase.com', 'supabase.co'] },
  github:    { tokens: ['github'],      legitOwners: ['github'],                 canonicalHosts: ['github.com'] },
  slack:     { tokens: ['slack'],       legitOwners: ['slackhq'],                canonicalHosts: ['slack.com'] },
  stripe:    { tokens: ['stripe'],      legitOwners: ['stripe'],                 canonicalHosts: ['stripe.com'] },
  shopify:   { tokens: ['shopify'],     legitOwners: ['shopify'],                canonicalHosts: ['shopify.com', 'shopify.dev'] },
  vercel:    { tokens: ['vercel'],      legitOwners: ['vercel', 'vercel-labs'],  canonicalHosts: ['vercel.com'] },
  cloudflare:{ tokens: ['cloudflare'],  legitOwners: ['cloudflare'],             canonicalHosts: ['cloudflare.com'] },
  figma:     { tokens: ['figma'],       legitOwners: ['figma'],                  canonicalHosts: ['figma.com'] },
  anthropic: { tokens: ['anthropic'],   legitOwners: ['anthropics'],             canonicalHosts: ['anthropic.com', 'claude.com', 'claude.ai'] },
  openai:    { tokens: ['openai'],      legitOwners: ['openai'],                 canonicalHosts: ['openai.com'] },
  mongodb:   { tokens: ['mongodb', 'mongo'], legitOwners: ['mongodb'],           canonicalHosts: ['mongodb.com'] },
  postgres:  { tokens: ['postgres'],    legitOwners: ['postgres', 'supabase'],   canonicalHosts: ['postgresql.org'] },
  airtable:  { tokens: ['airtable'],    legitOwners: ['airtable'],               canonicalHosts: ['airtable.com'] },
  atlassian: { tokens: ['atlassian', 'jira', 'confluence'], legitOwners: ['atlassian'], canonicalHosts: ['atlassian.com', 'atlassian.net'] },
  hubspot:   { tokens: ['hubspot'],     legitOwners: ['hubspot'],                canonicalHosts: ['hubspot.com'] },
  salesforce:{ tokens: ['salesforce'],  legitOwners: ['salesforce'],             canonicalHosts: ['salesforce.com', 'force.com'] },
  notionhq:  { tokens: ['notionhq'],    legitOwners: ['makenotion'],             canonicalHosts: ['notion.com', 'notion.so'] },
  claude:    { tokens: ['claude'],      legitOwners: ['anthropics'],             canonicalHosts: ['anthropic.com', 'claude.com', 'claude.ai'] },
}

// Match a registry entry's remote host against a brand's canonical hosts.
// Accepts an exact match ("notion.com") or a subdomain suffix
// ("mcp.notion.com" ends with ".notion.com"). Never a bare substring
// match — that would clear "attacker-notion.com".
function hostMatchesBrand(host: string, canonicalHosts: string[]): boolean {
  if (!host) return false
  for (const c of canonicalHosts) {
    if (host === c) return true
    if (host.endsWith('.' + c)) return true
  }
  return false
}

function normalise(name: string): string {
  // Reverse-DNS registry names have the form "com.example/thing".
  // Strip the namespace prefix, lowercase, collapse punctuation. We
  // want "linearmcp" from "ai.linear/mcp" so the match surface
  // concentrates on the product name, not the TLD.
  const tail = name.includes('/') ? name.split('/').slice(1).join('/') : name
  return tail.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function namespaceOf(name: string): string {
  return name.includes('/') ? name.split('/')[0]!.toLowerCase() : name.toLowerCase()
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

function repoOwnerOf(url?: string): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url)
    const parts = u.pathname.replace(/^\/+/, '').split('/')
    return (parts[0] ?? '').toLowerCase() || undefined
  } catch { return undefined }
}

// Classic Levenshtein. O(n*m). We only call it on short (<40 char)
// strings and within small buckets, so no need for optimisations.
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const prev = new Array(b.length + 1)
  for (let i = 0; i <= b.length; i++) prev[i] = i
  for (let i = 1; i <= a.length; i++) {
    let curr = i
    for (let j = 1; j <= b.length; j++) {
      const ins = prev[j] + 1
      const del = curr + 1
      const sub = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      prev[j - 1] = curr
      curr = Math.min(ins, del, sub)
    }
    prev[b.length] = curr
  }
  return prev[b.length]
}

interface Args { index: string; out: string; maxDistance: number; minLength: number }

function parseArgs(argv: string[]): Args {
  const get = (f: string, dflt?: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(f + '='))
    return hit ? hit.slice(f.length + 1) : dflt
  }
  return {
    index: get('--index', 'bench/registry-index.json')!,
    out: get('--out', 'bench/impersonation-report.json')!,
    maxDistance: Number(get('--max-distance', '2')!),
    minLength: Number(get('--min-length', '5')!),
  }
}

function pickEntry(e: IndexEntry): ImpersonationPair['entryA'] {
  return { name: e.name, remoteUrl: e.remoteUrl, repositoryUrl: e.repositoryUrl, description: e.description?.slice(0, 160) }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const file = JSON.parse(readFileSync(args.index, 'utf8')) as IndexFile
  const entries = file.entries.filter((e) => e.isLatest !== false)  // one row per server name

  // Group by normalised-name 3-char prefix so we only compare within
  // buckets. Edit distance ≤ 2 implies the first 3 chars match in at
  // least one shift, so bucketing by first-3 catches the usual cases
  // while cutting the pair count from O(n^2) to O(sum k^2).
  const byPrefix = new Map<string, IndexEntry[]>()
  for (const e of entries) {
    const n = normalise(e.name)
    if (n.length < args.minLength) continue
    const key = n.slice(0, 3)
    const bucket = byPrefix.get(key) ?? []
    bucket.push(e)
    byPrefix.set(key, bucket)
    // Also bucket under shifted prefix so we catch "linear" vs "linera"
    const shifted = n.slice(1, 4)
    if (shifted.length === 3) {
      const b2 = byPrefix.get(shifted) ?? []
      b2.push(e)
      byPrefix.set(shifted, b2)
    }
  }

  const pairs: ImpersonationPair[] = []
  const seenKey = new Set<string>()

  for (const bucket of byPrefix.values()) {
    if (bucket.length < 2) continue
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i]!, b = bucket[j]!
        const key = a.name < b.name ? a.name + '||' + b.name : b.name + '||' + a.name
        if (seenKey.has(key)) continue
        seenKey.add(key)

        const na = normalise(a.name), nb = normalise(b.name)
        if (na === nb) continue
        if (Math.abs(na.length - nb.length) > args.maxDistance) continue
        const d = editDistance(na, nb)
        if (d > args.maxDistance) continue

        // Legit-variant filter: same namespace + repo owner usually
        // just means the same project published twice.
        const nsA = namespaceOf(a.name), nsB = namespaceOf(b.name)
        const ownerA = repoOwnerOf(a.repositoryUrl), ownerB = repoOwnerOf(b.repositoryUrl)
        const hostA = hostOf(a.remoteUrl), hostB = hostOf(b.remoteUrl)

        const sameNamespace = nsA === nsB
        const sameOwner = ownerA && ownerB && ownerA === ownerB
        const sameHost = hostA && hostB && hostA === hostB

        // Keep the pair only when at least one identity signal
        // differs AND at least one is "unknown owner" or clearly a
        // different team.
        if (sameNamespace && sameOwner) continue
        if (sameHost && sameOwner) continue

        const signal =
          !ownerA || !ownerB ? 'one-side-unknown-owner' :
          ownerA !== ownerB && hostA !== hostB ? 'different-owner-and-host' :
          ownerA !== ownerB ? 'different-repo-owner' :
          hostA !== hostB ? 'different-host' :
          'namespace-divergence'

        // Drop the 'one-side-unknown-owner' flood: when neither has a
        // repository url, we have no identity signal at all, so any
        // near-name is just common product noise ("signals", "docs",
        // "chat", ...). Keep only pairs where at least one side has
        // a repo, and the OTHER side's repo owner is different or
        // missing, AND distance is a strict 1 (actual typo range).
        if (signal === 'one-side-unknown-owner') {
          if (!ownerA && !ownerB) continue
          if (d > 1) continue
        }

        pairs.push({
          nameA: a.name, nameB: b.name,
          normalisedA: na, normalisedB: nb,
          editDistance: d,
          signal,
          entryA: pickEntry(a), entryB: pickEntry(b),
        })
      }
    }
  }

  // Brand lookalike pass (v2 — strict):
  //
  // v1 used edit distance 1-2 on the normalised entry name, which produced
  // three unseparable classes of flags: real typosquats, independent
  // products with coincidental letter overlap (openaq ≠ openai, eigma ≠
  // figma), and legitimate third-party wrappers using the brand name as a
  // noun inside a namespace they own (com.hasdata/shopify, com.jocktaxes/
  // claude). v2 narrows to signals that cannot be explained by reverse-DNS
  // naming conventions:
  //
  //   S1 exact-token-match-in-namespace:
  //      The dotted namespace prefix itself matches the brand (e.g.
  //      "com.linear/*", "io.notion/*"). Legit unless the owner matches.
  //      Captures brand-namespace squats.
  //
  //   S2 exact-token-match-with-typo-distance-1:
  //      The repo portion of the name is an edit-distance-1 near-miss of
  //      the brand (e.g. "linaer", "stirpe"). Classic typosquat.
  //
  // We deliberately drop the "contains the brand" heuristic entirely
  // ("linearmcp" matched Linear before). Third-party wrappers legitimately
  // use the brand as the product noun; without content-level verification
  // we cannot tell wrapper from impostor. That filter moves to an offline
  // manual review stage, not this detector.
  const brandRisks: WellKnownRisk[] = []
  for (const e of entries) {
    const owner = repoOwnerOf(e.repositoryUrl) ?? ''
    const host = hostOf(e.remoteUrl)
    const [nsRaw, repoRaw] = e.name.includes('/') ? e.name.split('/', 2) as [string, string] : [e.name, '']
    const nsTail = (nsRaw.split('.').pop() ?? '').toLowerCase()
    const repoLc = repoRaw.toLowerCase()

    for (const [brand, meta] of Object.entries(BRANDS)) {
      const legitByOwner = meta.legitOwners.some((o) => owner === o || host.includes(o + '.'))
      const legitByHost = hostMatchesBrand(host, meta.canonicalHosts)
      if (legitByOwner || legitByHost) continue

      let signal: string | undefined
      let distance = Number.MAX_SAFE_INTEGER

      for (const t of meta.tokens) {
        // Only d=0 matches survive. Rationale: short brand strings (4-7
        // chars) have too many independent products at edit distance 1
        // (openaq vs openai, eigma vs figma, mondo vs mongodb). Those
        // matches cannot be distinguished from typosquats without
        // offline manual review, so we do not output them from an
        // automated detector.
        //
        // S1 — namespace-tail squats: "com.<brand>/*" where the owner
        // of that namespace is not the legitimate brand. Cannot be a
        // naming coincidence; someone registered the brand's exact
        // reverse-DNS prefix.
        if (nsTail === t) { signal = 's1-namespace-tail-is-brand'; distance = 0; break }
      }
      if (!signal) continue
      brandRisks.push({ target: brand, candidate: pickEntry(e), editDistance: distance, signal })
    }
  }

  pairs.sort((a, b) => a.editDistance - b.editDistance || a.nameA.localeCompare(b.nameA))
  brandRisks.sort((a, b) => a.editDistance - b.editDistance || a.target.localeCompare(b.target))

  const bySignal: Record<string, number> = {}
  for (const p of pairs) bySignal[p.signal] = (bySignal[p.signal] ?? 0) + 1

  const report = {
    generatedAt: new Date().toISOString(),
    entriesScanned: entries.length,
    totalPairsFlagged: pairs.length,
    pairsBySignal: bySignal,
    totalBrandLookalikes: brandRisks.length,
    pairs,
    brandRisks,
  }
  writeFileSync(args.out, JSON.stringify(report, null, 2), 'utf8')

  // Console summary
  process.stdout.write('\n=== IMPERSONATION DETECTOR ===\n')
  process.stdout.write('entries scanned        ' + entries.length + '\n')
  process.stdout.write('pair flags             ' + pairs.length + '\n')
  for (const [k, v] of Object.entries(bySignal).sort((a, b) => b[1] - a[1])) {
    process.stdout.write('  ' + k.padEnd(28) + ' ' + v + '\n')
  }
  process.stdout.write('brand lookalikes       ' + brandRisks.length + '\n')
  process.stdout.write('\n--- top 20 pairs (lowest edit distance first) ---\n')
  for (const p of pairs.slice(0, 20)) {
    process.stdout.write('  d=' + p.editDistance + '  [' + p.signal + ']  ' + p.nameA + '  <->  ' + p.nameB + '\n')
  }
  process.stdout.write('\n--- top 20 brand lookalikes ---\n')
  for (const r of brandRisks.slice(0, 20)) {
    process.stdout.write('  d=' + r.editDistance + '  ' + r.target.padEnd(12) + '  <- ' + r.candidate.name + '  (repo: ' + (r.candidate.repositoryUrl ?? '-') + ')\n')
  }
  process.stdout.write('\nwrote ' + args.out + '\n')
}

main()
