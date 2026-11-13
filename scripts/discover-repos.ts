#!/usr/bin/env node
/**
 * Enrich bench/registry-index.json with discovered repository URLs for
 * entries the registry itself does not carry.
 *
 * In the MVP crawl 65 % of 500 servers had no repository.url — this
 * script closes that gap with four cheap heuristics, in order:
 *
 *   1. websiteUrl scrape — fetch the server's website HTML and look
 *      for a github.com link in the body (footer / "view source" /
 *      repo badge). Covers landing-page open-source projects.
 *
 *   2. host-to-github — derive candidate GitHub owners from the MCP
 *      host and the dotted registry name. "ac.inference.sh/mcp" →
 *      try github.com/inference-sh, github.com/ac-inference-sh,
 *      github.com/inference-ac. Validates by HEAD-ing GitHub for 200.
 *
 *   3. GitHub repo search — one query per unmatched entry using the
 *      canonical name + "mcp" keyword. Authenticated via GH_TOKEN if
 *      set; falls back to anonymous (10 req/min). Picks the best match
 *      by name similarity + recent-push signal.
 *
 *   4. npm registry lookup — many MCP servers ship on npm. Query
 *      registry.npmjs.org for packages that match the server name;
 *      pull repository.url from package.json. Fast and auth-free.
 *
 * Output: bench/registry-index-enriched.json with the same shape as
 * the input plus:
 *   repositoryUrl         — the discovered URL (stays undefined if
 *                           everything missed)
 *   repositorySource      — 'registry' | 'website-scrape' | 'host-guess'
 *                           | 'github-search' | 'npm-lookup'
 *
 * Usage:
 *   npx tsx scripts/discover-repos.ts
 *   npx tsx scripts/discover-repos.ts --limit=500 --concurrency=4
 *   npx tsx scripts/discover-repos.ts --in=bench/registry-index.json --out=bench/registry-index-enriched.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const USER_AGENT = 'patchbay-crawler/0.9.0 (+https://patchbay-mcp.dev/about-crawler)'
const DEFAULT_CONCURRENCY = 6
const FETCH_TIMEOUT_MS = 10_000
const GITHUB_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN

interface IndexEntry {
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

interface IndexFile { capturedAt: string; entries: IndexEntry[]; [k: string]: unknown }

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, headers: { 'user-agent': USER_AGENT, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
}

function normaliseRepoUrl(raw: string): string | undefined {
  try {
    const u = new URL(raw)
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return undefined
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').split('/')
    if (parts.length < 2) return undefined
    return 'https://github.com/' + parts[0] + '/' + parts[1].replace(/\.git$/, '')
  } catch { return undefined }
}

// Common library repos that websites link to without being the subject
// of the link. Hard-reject these so website-scrape does not drag them in.
const SHARED_LIBRARY_OWNERS = new Set([
  'pacocoursey', 'vercel', 'nextjs', 'reactjs', 'facebook', 'microsoft',
  'radix-ui', 'tailwindlabs', 'shadcn-ui', 'shadcn', 'twbs', 'twitter',
  'ant-design', 'mui', 'material-ui', 'emotion-js', 'styled-components',
  'webpack', 'babel', 'nodejs', 'npm', 'yarnpkg', 'pnpm', 'denoland',
  'oven-sh', 'apache', 'eslint', 'prettier', 'typescript', 'typescript-eslint',
  'framer', 'motion', 'lodash', 'moment', 'date-fns',
  // single-word generic owners that squat org names
  'mcp', 'api', 'docs', 'test', 'demo', 'sandbox', 'example',
])

function tokensFor(entry: IndexEntry): string[] {
  const t = new Set<string>()
  const addCandidate = (s: string): void => { if (s && s.length >= 3) t.add(s.toLowerCase()) }
  try {
    const host = new URL(entry.remoteUrl).hostname.replace(/^www\./, '')
    for (const p of host.split('.')) addCandidate(p)
  } catch { /* skip */ }
  for (const p of entry.name.split(/[./]/)) addCandidate(p)
  if (entry.title) addCandidate(entry.title.split(/\s+/)[0] ?? '')
  // Drop tokens that are generic noise or TLDs
  const stopWords = new Set(['com', 'org', 'net', 'io', 'ai', 'app', 'dev', 'mcp', 'api', 'server', 'tools', 'the', 'and', 'inc', 'ltd', 'llc'])
  return [...t].filter((s) => !stopWords.has(s))
}

function scoreRepoForEntry(entry: IndexEntry, repoUrl: string): number {
  const tokens = tokensFor(entry)
  try {
    const u = new URL(repoUrl)
    const [owner, repo] = u.pathname.replace(/^\/+/, '').split('/') as [string, string]
    const ownerLc = owner.toLowerCase()
    const repoLc = repo.toLowerCase()
    if (SHARED_LIBRARY_OWNERS.has(ownerLc)) return -100
    let s = 0
    for (const t of tokens) {
      if (ownerLc.includes(t)) s += 3
      if (repoLc.includes(t)) s += 2
    }
    if (repoLc.includes('mcp')) s += 2
    if (/^\d+$/.test(repoLc) || repoLc.length < 3) s -= 5
    return s
  } catch { return -100 }
}

async function trySiteScrape(entry: IndexEntry): Promise<string | undefined> {
  const target = entry.websiteUrl ?? new URL(entry.remoteUrl).origin
  try {
    const r = await fetchWithTimeout(target)
    if (!r.ok) return undefined
    const html = (await r.text()).slice(0, 400_000)
    const hits = html.match(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g) ?? []
    const candidates: { url: string; score: number }[] = []
    for (const raw of hits) {
      const canon = normaliseRepoUrl(raw)
      if (!canon) continue
      if (/\/(blog|docs|download|releases|security-advisories)$/i.test(canon)) continue
      if (/github\.com\/(features|about|login|signup|pricing|security|customer-stories|topics)/i.test(canon)) continue
      const score = scoreRepoForEntry(entry, canon)
      if (score >= 2) candidates.push({ url: canon, score })
    }
    if (!candidates.length) return undefined
    candidates.sort((a, b) => b.score - a.score)
    return candidates[0]!.url
  } catch { return undefined }
}

function candidateOwnersFor(entry: IndexEntry): string[] {
  const out = new Set<string>()
  const addCandidate = (s: string): void => { if (s && /^[a-z0-9-]{1,39}$/i.test(s)) out.add(s) }

  const host = (() => { try { return new URL(entry.remoteUrl).hostname.replace(/^www\./, '') } catch { return '' } })()
  const name = entry.name

  // The registry name is of the form "reverse-dns.thing/package" e.g.
  // "ac.inference.sh/mcp", "io.github.user/repo", "com.company/server".
  const [nsRaw, repoRaw] = name.includes('/') ? name.split('/', 2) : [name, undefined]
  const ns = nsRaw!
  const dotParts = ns.split('.').filter(Boolean)

  // io.github.<user>/* → github owner is <user>
  if (dotParts[0] === 'io' && dotParts[1] === 'github' && dotParts[2]) addCandidate(dotParts[2])
  // com.github.<user>/* → same
  if (dotParts[0] === 'com' && dotParts[1] === 'github' && dotParts[2]) addCandidate(dotParts[2])
  // io.<user>/* → try <user>
  if (dotParts[0] === 'io' && dotParts[1]) addCandidate(dotParts[1])
  // <foo>.<bar>.<tld>/* → try <foo>-<bar>, <foo>, <bar>
  if (dotParts.length >= 2) {
    addCandidate(dotParts.slice(0, -1).join('-'))
    addCandidate(dotParts[0]!)
    addCandidate(dotParts[dotParts.length - 2]!)
  }
  // Host-derived (foo.bar.com → foo-bar, foo)
  if (host) {
    const hostParts = host.split('.').filter(Boolean)
    if (hostParts.length >= 2) {
      addCandidate(hostParts[0]!)
      addCandidate(hostParts.slice(0, -1).join('-'))
    }
  }
  void repoRaw
  return [...out]
}

function candidateRepoNamesFor(entry: IndexEntry): string[] {
  const names = new Set<string>()
  const addCandidate = (s: string): void => { if (s && s.length <= 100 && /^[a-z0-9_.-]+$/i.test(s)) names.add(s) }
  const nameParts = entry.name.includes('/') ? entry.name.split('/')[1]! : entry.name
  for (const p of nameParts.split(/[./]/)) addCandidate(p)
  addCandidate(nameParts.replace(/[./]/g, '-'))
  addCandidate('mcp-' + nameParts.replace(/[./]/g, '-'))
  addCandidate(nameParts.replace(/[./]/g, '-') + '-mcp')
  if (entry.title) addCandidate(entry.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]+/g, ''))
  return [...names]
}

async function githubRepoExists(owner: string, repo: string): Promise<boolean> {
  try {
    const r = await fetchWithTimeout('https://api.github.com/repos/' + owner + '/' + repo, {
      method: 'GET',
      headers: GITHUB_TOKEN ? { authorization: 'Bearer ' + GITHUB_TOKEN, accept: 'application/vnd.github+json' } : { accept: 'application/vnd.github+json' },
    })
    return r.status === 200
  } catch { return false }
}

async function tryHostGuess(entry: IndexEntry): Promise<string | undefined> {
  const owners = candidateOwnersFor(entry)
  const repos = candidateRepoNamesFor(entry)
  // Cap the probe matrix: owners x repos can explode. Cap at 10 combos.
  let tried = 0
  for (const owner of owners) {
    for (const repo of repos) {
      if (tried >= 10) return undefined
      tried += 1
      if (await githubRepoExists(owner, repo)) return 'https://github.com/' + owner + '/' + repo
    }
  }
  return undefined
}

async function tryGithubSearch(entry: IndexEntry): Promise<string | undefined> {
  if (!GITHUB_TOKEN) return undefined  // search is 10 req/min anon, we skip rather than get throttled
  const q = encodeURIComponent((entry.name.includes('/') ? entry.name.split('/')[1]! : entry.name) + ' mcp')
  try {
    const r = await fetchWithTimeout('https://api.github.com/search/repositories?q=' + q + '&per_page=5&sort=updated', {
      headers: { authorization: 'Bearer ' + GITHUB_TOKEN, accept: 'application/vnd.github+json' },
    })
    if (!r.ok) return undefined
    const body = await r.json() as { items?: Array<{ html_url?: string; name?: string }> }
    const nameLc = entry.name.toLowerCase().replace(/[./]/g, '-')
    const items = body.items ?? []
    // Pick the first that scores high: matching name substring or MCP keyword
    for (const it of items) {
      if (!it.html_url) continue
      const canon = normaliseRepoUrl(it.html_url)
      if (!canon) continue
      if ((it.name ?? '').toLowerCase().includes('mcp')) return canon
      if ((it.name ?? '').toLowerCase().includes(nameLc.split('-')[0] ?? '')) return canon
    }
    // Fallback: first result
    const first = normaliseRepoUrl(items[0]?.html_url ?? '')
    return first
  } catch { return undefined }
}

async function tryNpmLookup(entry: IndexEntry): Promise<string | undefined> {
  const pkgCandidates = new Set<string>()
  // Full dotted name as a package: "ac.inference.sh/mcp" → "ac.inference.sh-mcp"
  pkgCandidates.add(entry.name.replace(/\//g, '-'))
  // Compound: the trailing path merged into the namespace with a dash
  const GENERIC_PKGS = new Set(['mcp', 'mcp-server', 'server', 'tools', 'api', 'docs', 'example', 'demo', 'core', 'cli'])
  if (entry.name.includes('/')) {
    const [ns, repo] = entry.name.split('/', 2) as [string, string]
    // Require a distinctive package name: e.g. "mcp-" prefix or the NS joined
    pkgCandidates.add(ns + '-' + repo)
    // Skip bare "repo" names that are too generic to identify the entry
    if (repo.toLowerCase().includes('mcp') && !GENERIC_PKGS.has(repo.toLowerCase())) pkgCandidates.add(repo)
    // Scoped packages mapped from the dotted namespace's tld-ish tail
    const scopeGuess = ns.split('.').pop()
    if (scopeGuess) {
      pkgCandidates.add('@' + scopeGuess + '/' + repo)
      pkgCandidates.add('@' + scopeGuess + '/mcp')
    }
  }

  const nameParts = entry.name.toLowerCase().replace(/[./]/g, '-').split('-').filter(Boolean)

  for (const pkg of pkgCandidates) {
    try {
      const r = await fetchWithTimeout('https://registry.npmjs.org/' + encodeURIComponent(pkg))
      if (!r.ok) continue
      const body = await r.json() as { repository?: { url?: string }; description?: string; keywords?: string[] }
      const url = body.repository?.url
      if (!url) continue
      const canon = normaliseRepoUrl(url.replace(/^git\+/, '').replace(/\.git$/, ''))
      if (!canon) continue

      // Guardrails against generic-name collisions (e.g. "tts", "snag"):
      // accept only if (a) the package name itself mentions mcp, OR
      // (b) the npm description / keywords mention mcp, OR
      // (c) the scoped-or-dotted name uniquely matches this entry (long enough).
      const pkgLc = pkg.toLowerCase()
      const descLc = (body.description ?? '').toLowerCase()
      const keyw = (body.keywords ?? []).join(' ').toLowerCase()
      // Package name "mcp-foo" is too generic — "mcp-server" matches
      // anyone's generic repo. Require that the npm description or
      // keywords ALSO carry an identity signal for this specific entry.
      const matchedParts = nameParts.filter((p) => p.length > 2 && pkgLc.includes(p)).length
      const descMatchesEntry = nameParts.some((p) => p.length > 3 && descLc.includes(p))
      if ((pkgLc.includes('mcp') || keyw.includes('mcp')) && descMatchesEntry) return canon
      if (descLc.includes('model context protocol') && descMatchesEntry) return canon
      if (matchedParts >= 2 && pkg.length >= 10) return canon
    } catch { /* keep trying */ }
  }
  return undefined
}

async function discover(entry: IndexEntry): Promise<{ url?: string; source?: string }> {
  // Order: cheapest + highest precision first.
  const scrape = await trySiteScrape(entry)
  if (scrape) return { url: scrape, source: 'website-scrape' }
  const npm = await tryNpmLookup(entry)
  if (npm) return { url: npm, source: 'npm-lookup' }
  const guess = await tryHostGuess(entry)
  if (guess) return { url: guess, source: 'host-guess' }
  const search = await tryGithubSearch(entry)
  if (search) return { url: search, source: 'github-search' }
  return {}
}

function parseArgs(argv: string[]): { in: string; out: string; limit: number; concurrency: number } {
  const get = (f: string, dflt?: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(f + '='))
    return hit ? hit.slice(f.length + 1) : dflt
  }
  return {
    in: get('--in', 'bench/registry-index.json')!,
    out: get('--out', 'bench/registry-index-enriched.json')!,
    limit: Number(get('--limit', String(Infinity))!),
    concurrency: Number(get('--concurrency', String(DEFAULT_CONCURRENCY))!),
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!existsSync(args.in)) { console.error('input not found: ' + args.in); process.exit(2) }
  const file = JSON.parse(readFileSync(args.in, 'utf8')) as IndexFile

  // Resume: entries that already have a repoUrl do not need re-processing.
  for (const e of file.entries) if (e.repositoryUrl && !e.repositorySource) e.repositorySource = 'registry'

  const pending = file.entries.filter((e) => !e.repositoryUrl)
  const cap = Math.min(pending.length, Number.isFinite(args.limit) ? args.limit : pending.length)
  const queue = pending.slice(0, cap)

  process.stderr.write('entries total: ' + file.entries.length + '\n')
  process.stderr.write('with repo url (registry): ' + (file.entries.length - pending.length) + '\n')
  process.stderr.write('to discover: ' + queue.length + '\n')
  process.stderr.write('concurrency: ' + args.concurrency + (GITHUB_TOKEN ? ' (github search enabled)' : ' (github search skipped — no GH_TOKEN)') + '\n\n')

  const totals = { discovered: 0, tried: 0, bySource: {} as Record<string, number> }
  const startedAt = Date.now()

  async function worker(): Promise<void> {
    for (;;) {
      const entry = queue.shift()
      if (!entry) return
      totals.tried += 1
      try {
        const { url, source } = await discover(entry)
        if (url && source) {
          entry.repositoryUrl = url
          entry.repositorySource = source
          totals.discovered += 1
          totals.bySource[source] = (totals.bySource[source] ?? 0) + 1
        }
      } catch (e) { void e }
      if (totals.tried % 25 === 0) {
        const elapsedS = Math.round((Date.now() - startedAt) / 1000)
        process.stderr.write('[' + totals.tried + '] ' + elapsedS + 's elapsed, ' + totals.discovered + ' hits (' + (totals.discovered / totals.tried * 100).toFixed(1) + '%)\n')
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, args.concurrency) }, () => worker()))

  writeFileSync(args.out, JSON.stringify(file, null, 2), 'utf8')
  process.stderr.write(
    '\nwrote ' + args.out + '\n' +
    '  discovered ' + totals.discovered + ' / ' + totals.tried + ' (' + (totals.discovered / Math.max(1, totals.tried) * 100).toFixed(1) + '%)\n' +
    '  by source: ' + JSON.stringify(totals.bySource) + '\n',
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
