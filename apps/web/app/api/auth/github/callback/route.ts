import { NextResponse } from 'next/server'
import { createSessionCookie, OAUTH_STATE_COOKIE, SESSION_COOKIE, sessionCookieOptions } from '@/lib/github-session'
import { verifyState } from '@/lib/oauth-state'

const CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID || 'Ov23lizixaGvJ8OTZXMy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GitHub redirects here after the user authorises patchbay. We swap the
 * one-time `code` for a long-lived user access token, fetch the user's
 * profile, and drop both into an HTTP-only cookie. Then bounce the user
 * back to wherever they started (default: home).
 *
 * The `state` echoed by GitHub must match the HttpOnly cookie we set when
 * the flow began — that's the CSRF defence. The `next` redirect target is
 * verified to be a same-origin relative path to prevent open redirects.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') ?? ''
  const stateCookie = request.headers.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith(`${OAUTH_STATE_COOKIE}=`))?.slice(OAUTH_STATE_COOKIE.length + 1)

  if (!code) {
    return NextResponse.redirect(new URL('/?gh=cancelled', url.origin))
  }

  const verified = verifyState(state, stateCookie)
  if (!verified.ok) {
    return NextResponse.redirect(new URL('/?gh=failed&reason=state_mismatch', url.origin))
  }
  const next = verified.next

  const secret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'GITHUB_OAUTH_CLIENT_SECRET not configured' }, { status: 500 })
  }

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
  // State cookie is single-use.
  redirect.cookies.set(OAUTH_STATE_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return redirect
}
