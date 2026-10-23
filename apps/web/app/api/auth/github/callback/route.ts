import { NextResponse } from 'next/server'
import { createSessionCookie, SESSION_COOKIE, sessionCookieOptions } from '@/lib/github-session'

const CLIENT_ID = 'Ov23lizixaGvJ8OTZXMy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GitHub redirects here after the user authorises patchbay. We swap the
 * one-time `code` for a long-lived user access token, fetch the user's
 * profile, and drop both into an HTTP-only cookie. Then bounce the user
 * back to wherever they started (default: home).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  if (!code) {
    return NextResponse.redirect(new URL('/?gh=cancelled', url.origin))
  }
  const secret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'GITHUB_OAUTH_CLIENT_SECRET not configured' }, { status: 500 })
  }

  let next = '/'
  try {
    const state = JSON.parse(Buffer.from(stateRaw ?? '', 'base64url').toString('utf8')) as { next?: string }
    if (state.next && state.next.startsWith('/')) next = state.next
  } catch {}

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: secret, code, redirect_uri: `${url.origin}/api/auth/github/callback` }),
  })
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string }
  if (!tokenJson.access_token) {
    return NextResponse.redirect(new URL(`/?gh=failed&reason=${encodeURIComponent(tokenJson.error ?? 'no_token')}`, url.origin))
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}`, Accept: 'application/vnd.github+json' },
  })
  if (!userRes.ok) {
    return NextResponse.redirect(new URL('/?gh=failed&reason=profile', url.origin))
  }
  const user = (await userRes.json()) as { login: string; name: string | null; avatar_url: string }

  const cookie = await createSessionCookie({
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    accessToken: tokenJson.access_token,
  })

  const redirect = NextResponse.redirect(new URL(`${next}?gh=connected`, url.origin))
  redirect.cookies.set(SESSION_COOKIE, cookie, sessionCookieOptions())
  return redirect
}
