import { readSession } from '@/lib/github-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface GhRepo {
  full_name: string
  name: string
  owner: { login: string }
  private: boolean
  default_branch: string
  permissions?: { push?: boolean }
  updated_at: string
}

export async function GET() {
  const session = await readSession()
  if (!session) return Response.json({ error: 'not_connected' }, { status: 401 })

  // Grab the user's 100 most recently touched repos — plenty for a picker;
  // the API caps at 100 per page and we don't want to paginate for a demo.
  const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator', {
    headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return Response.json({ error: 'github_api_failed', detail: text }, { status: res.status })
  }
  const repos = (await res.json()) as GhRepo[]
  const pushable = repos
    .filter(r => r.permissions?.push !== false)
    .map(r => ({
      fullName: r.full_name,
      owner: r.owner.login,
      name: r.name,
      private: r.private,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
    }))
  return Response.json({ repos: pushable })
}
