import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { OAUTH_STATE_COOKIE } from '@/lib/github-session'
import { isSafeRelativePath, sign } from '@/lib/oauth-state'

const CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID || 'Ov23lizixaGvJ8OTZXMy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Start the GitHub OAuth flow. Redirects the user to GitHub where they
 * authorise patchbay to read their repos and open PRs. On approval, GitHub
 * sends them back to /api/auth/github/callback with a one-time code.
 *
 * The `state` parameter is HMAC-signed with GITHUB_OAUTH_SESSION_SECRET and
 * also persisted in a short-lived HttpOnly cookie — the callback refuses any
 * request where the two don't match. That is the CSRF defence; without it an
 * attacker could craft a malicious callback URL that drops their session
 * cookie into a victim's browser.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const raw = url.searchParams.get('next') ?? '/'
  const next = isSafeRelativePath(raw) ? raw : '/'

  const nonce = randomBytes(16).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ next, nonce })).toString('base64url')
  const sig = sign(payload)
  const state = `${payload}.${sig}`

  const callback = `${url.origin}/api/auth/github/callback`
  const authorize = new URL('https://github.com/login/oauth/authorize')
  authorize.searchParams.set('client_id', CLIENT_ID)
  authorize.searchParams.set('redirect_uri', callback)
  authorize.searchParams.set('scope', 'repo')
  authorize.searchParams.set('state', state)

  const res = NextResponse.redirect(authorize.toString())
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
