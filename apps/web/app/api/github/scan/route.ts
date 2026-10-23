import { scanFiles, type ScanInputFile, type Opportunity } from '@patchbay-nebius/agent'
import { readSession } from '@/lib/github-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Scan any GitHub repo (public, or private if the connected user owns it) for
 * integration opportunities patchbay could build. Uses the GitHub REST API
 * (git/trees recursive + raw content) so we never need to git-clone — this
 * works inside a read-only Vercel lambda and finishes in <10s on a typical repo.
 */
const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rb'])
const SCAN_ENV_BASENAMES = new Set(['.env', '.env.example', '.env.sample', '.env.local'])
const MAX_FILES = 600          // hard cap on files we actually fetch content for
const MAX_FILE_BYTES = 300_000
const SKIP_DIR_RE = /(^|\/)(node_modules|\.git|dist|\.next|out|build|\.turbo|\.vercel|coverage|__generated__)(\/|$)/

// Dirs that produce noise (fixtures, demos, docs code) — we only scan them if
// nothing more useful filled the budget.
const NOISE_DIR_RE = /(^|\/)(__fixtures__|fixtures|__tests__|tests?|spec|specs|e2e|examples?|demo|demos|docs?|stories|storybook|scripts|benchmark|fixtures?)(\/|$)/i

/**
 * Score a file path by how likely it is to carry a real integration signal.
 * Higher score = fetched first and more likely to make the budget.
 */
function pathSignal(path: string): number {
  const p = path.toLowerCase()
  const base = p.split('/').pop() ?? ''
  let score = 0
  if (SCAN_ENV_BASENAMES.has(base)) score += 100
  if (/(webhook|hook|integration|connector|callback|handler)/.test(p)) score += 40
  if (/(^|\/)(api|routes|server|handlers|webhooks|integrations)(\/|$)/.test(p)) score += 20
  if (/\.(ts|tsx|py|go|rb)$/.test(p)) score += 5
  if (/\.(js|jsx|mjs|cjs)$/.test(p)) score += 2
  if (NOISE_DIR_RE.test(p)) score -= 30
  if (/\.d\.ts$/.test(p)) score -= 50
  return score
}

interface GhTreeEntry { path: string; type: string; size?: number; sha: string }

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { repo?: string; ref?: string } | null
  const repo = body?.repo?.trim()
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return Response.json({ error: 'Pass a repo as "owner/name".' }, { status: 400 })
  }
  const session = await readSession()
  const token = session?.accessToken

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'patchbay-web',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    // 1. Resolve ref → tree SHA.
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers, cache: 'no-store' })
    if (!repoRes.ok) {
      return Response.json({ error: await ghError(repoRes, repo) }, { status: repoRes.status })
    }
    const repoInfo = (await repoRes.json()) as { default_branch: string; private: boolean }
    const ref = body?.ref || repoInfo.default_branch

    const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, {
      headers,
      cache: 'no-store',
    })
    if (!treeRes.ok) {
      return Response.json({ error: await ghError(treeRes, repo) }, { status: treeRes.status })
    }
    const tree = (await treeRes.json()) as { tree: GhTreeEntry[]; truncated: boolean }

    // 2. Pick the files worth scanning — rank by path signal, keep the top N.
    // This replaces "first 400 files in tree order" (which gave template repos a
    // view full of fixtures) with "the 600 paths most likely to carry a real
    // integration hint".
    const candidates = tree.tree.filter((e) => {
      if (e.type !== 'blob') return false
      if (SKIP_DIR_RE.test(e.path)) return false
      if ((e.size ?? 0) > MAX_FILE_BYTES) return false
      const base = e.path.split('/').pop()!.toLowerCase()
      if (SCAN_ENV_BASENAMES.has(base)) return true
      const ext = base.includes('.') ? '.' + base.split('.').pop() : ''
      return SCAN_EXTS.has(ext)
    })
    const picked = candidates
      .map((e) => ({ e, s: pathSignal(e.path) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_FILES)
      .map((x) => x.e)

    // 3. Fetch the content via raw.githubusercontent — one GET per file, in parallel.
    const files: ScanInputFile[] = []
    const CONCURRENCY = 16
    for (let i = 0; i < picked.length; i += CONCURRENCY) {
      const chunk = picked.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(
        chunk.map(async (entry) => {
          const rawUrl = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(ref)}/${entry.path.split('/').map(encodeURIComponent).join('/')}`
          const res = await fetch(rawUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' })
          if (!res.ok) return null
          const content = await res.text()
          return { path: entry.path, content }
        }),
      )
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) files.push(r.value)
      }
    }

    // 4. Run the shared scanner.
    const opportunities: Opportunity[] = scanFiles(files)
    return Response.json({
      repo,
      ref,
      scanned: files.length,
      totalCandidates: candidates.length,
      truncated: tree.truncated,
      private: repoInfo.private,
      opportunities,
    })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

async function ghError(res: Response, repo: string): Promise<string> {
  const text = await res.text().catch(() => '')
  if (res.status === 404) return `Repo "${repo}" not found (or private — sign in with GitHub to scan your private repos).`
  if (res.status === 403) return `GitHub rate limit hit. Sign in with GitHub for a higher limit.`
  return `GitHub returned HTTP ${res.status}: ${text.slice(0, 200)}`
}
