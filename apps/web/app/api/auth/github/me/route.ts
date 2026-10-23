import { readSession } from '@/lib/github-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await readSession()
  if (!session) return Response.json({ connected: false })
  return Response.json({
    connected: true,
    login: session.login,
    name: session.name,
    avatarUrl: session.avatarUrl,
  })
}
