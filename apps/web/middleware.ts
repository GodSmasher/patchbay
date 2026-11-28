import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Mail-provider Referer patterns. A click on https://patchbay-mcp.dev
// from a transactional cold-outreach lands on the connector-hackathon
// homepage; audit-outreach recipients expect the scanner instead. When
// the Referer identifies a mail provider's web UI or Resend's click
// tracker, send them to /audit. Hackathon traffic (direct navigation,
// X, HN, etc.) is unaffected.
const MAIL_REFERER = [
  'mail.google.com',
  'www.google.com/url',
  'outlook.live.com',
  'outlook.office.com',
  'outlook.office365.com',
  'mail.yahoo.com',
  'mail.proton.me',
  'resend.com',
  'click.resend.com',
  'r.resend.com',
]

/**
 * Middleware does three things in order:
 *
 * 1. Host-based routing: demo.patchbay-mcp.dev → /demo subtree rewrite
 *    (patchbay audit's remote probe discovers OAuth metadata with
 *    `new URL('/.well-known/oauth-*', mcpUrl)`, which resolves to the
 *    origin regardless of the MCP path. Serving the demo under
 *    demo.patchbay-mcp.dev gives a clean origin where /.well-known/*
 *    lives alongside /mcp, /authorize and /token.)
 *
 * 2. Mail-click redirect: on /, when Referer matches a known mail
 *    provider, send to /audit. Cold-outreach recipients expect the
 *    scanner, not the hackathon landing.
 *
 * 3. Supabase auth session refresh + /app/* gate (hosted-v1):
 *    unauthenticated /app/* traffic redirects to /signin?next=<path>.
 *    Auth refresh runs on every path so the session cookie stays live.
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0]

  // 1. demo.patchbay-mcp.dev → rewrite into /demo
  if (host === 'demo.patchbay-mcp.dev') {
    const { pathname, search } = req.nextUrl
    if (!pathname.startsWith('/demo')) {
      const target = req.nextUrl.clone()
      target.pathname = pathname === '/' ? '/demo' : '/demo' + pathname
      target.search = search
      return NextResponse.rewrite(target)
    }
    return NextResponse.next()
  }

  // 2. mail-click → /audit
  if (host === 'patchbay-mcp.dev' && req.nextUrl.pathname === '/') {
    const referer = (req.headers.get('referer') || '').toLowerCase()
    if (referer && MAIL_REFERER.some((p) => referer.includes(p))) {
      const target = req.nextUrl.clone()
      target.pathname = '/audit'
      target.searchParams.set('src', 'mail')
      return NextResponse.redirect(target, 302)
    }
  }

  // 3. Supabase auth session refresh + /app/* gate (hosted-v1)
  const response = NextResponse.next({ request: { headers: req.headers } })
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Fail open if Supabase env not set (preview deploys before hosted-v1
  // keys land, or local dev without the stack). Scaffolding — no crash.
  if (!supaUrl || !supaKey) return response

  const supabase = createServerClient(supaUrl, supaKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (req.nextUrl.pathname.startsWith('/app') && !user) {
    const signInUrl = req.nextUrl.clone()
    signInUrl.pathname = '/signin'
    signInUrl.searchParams.set('next', req.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
