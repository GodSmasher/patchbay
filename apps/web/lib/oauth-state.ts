import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * OAuth state is HMAC-signed with GITHUB_OAUTH_SESSION_SECRET so GitHub can
 * echo it back to our callback and we can verify both that we minted it and
 * that nobody tampered with it. Pair the signed state with a short-lived
 * HttpOnly cookie set at the start of the flow to defend against CSRF.
 */

export function isSafeRelativePath(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (path.startsWith('//') || path.startsWith('/\\')) return false
  if (/^\/+[^/]/.test(path) === false) return false
  try {
    const parsed = new URL(path, 'https://example.com')
    return parsed.origin === 'https://example.com'
  } catch {
    return false
  }
}

export function sign(payload: string): string {
  const secret = process.env.GITHUB_OAUTH_SESSION_SECRET
  if (!secret) throw new Error('GITHUB_OAUTH_SESSION_SECRET not configured')
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function verifyState(state: string, cookie: string | undefined): { ok: boolean; next: string } {
  if (!state || !cookie) return { ok: false, next: '/' }
  const a = Buffer.from(state)
  const b = Buffer.from(cookie)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, next: '/' }

  const [payload, sig] = state.split('.')
  if (!payload || !sig) return { ok: false, next: '/' }
  const expected = sign(payload)
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return { ok: false, next: '/' }
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { next?: string }
    const next = typeof decoded.next === 'string' && isSafeRelativePath(decoded.next) ? decoded.next : '/'
    return { ok: true, next }
  } catch {
    return { ok: false, next: '/' }
  }
}
