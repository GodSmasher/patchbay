import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

/**
 * GitHub OAuth session, carried as a signed JWT in an HTTP-only cookie.
 *
 * We stash: the user's github handle, avatar, and OAuth access token
 * (no refresh — GitHub user tokens don't expire unless the user revokes).
 * The whole payload is signed with GITHUB_OAUTH_SESSION_SECRET so we can trust
 * it on later requests without a server-side session store.
 */

export const SESSION_COOKIE = 'patchbay_gh'
export const OAUTH_STATE_COOKIE = 'patchbay_gh_state'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export interface GhSession {
  login: string
  name: string | null
  avatarUrl: string
  accessToken: string
}

function secret(): Uint8Array {
  const raw = process.env.GITHUB_OAUTH_SESSION_SECRET
  if (!raw || raw.length < 32) throw new Error('GITHUB_OAUTH_SESSION_SECRET must be set (32+ chars)')
  return new TextEncoder().encode(raw)
}

export async function createSessionCookie(session: GhSession): Promise<string> {
  const jwt = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(secret())
  return jwt
}

export async function readSession(): Promise<GhSession | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    const { login, name, avatarUrl, accessToken } = payload as unknown as GhSession
    if (!login || !accessToken) return null
    return { login, name: name ?? null, avatarUrl, accessToken }
  } catch {
    return null
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  }
}
