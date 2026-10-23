import { NextResponse } from 'next/server'

const CLIENT_ID = 'Ov23lizixaGvJ8OTZXMy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Start the GitHub OAuth flow. Redirects the user to GitHub where they
 * authorise patchbay to read their repos and open PRs. On approval, GitHub
 * sends them back to /api/auth/github/callback with a one-time code.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = url.searchParams.get('next') || '/'
  const state = Buffer.from(JSON.stringify({ next, nonce: crypto.randomUUID() })).toString('base64url')

  const callback = `${url.origin}/api/auth/github/callback`
  const authorize = new URL('https://github.com/login/oauth/authorize')
  authorize.searchParams.set('client_id', CLIENT_ID)
  authorize.searchParams.set('redirect_uri', callback)
  authorize.searchParams.set('scope', 'repo')
  authorize.searchParams.set('state', state)

  return NextResponse.redirect(authorize.toString())
}
