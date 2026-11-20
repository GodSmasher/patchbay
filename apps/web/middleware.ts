import { NextRequest, NextResponse } from 'next/server'

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
 * Host-based routing so demo.patchbay-mcp.dev maps onto the /demo subtree.
 *
 * patchbay audit's remote probe discovers OAuth metadata with
 * `new URL('/.well-known/oauth-*', mcpUrl)`, which resolves to the origin
 * regardless of the MCP path. Serving the demo under demo.patchbay-mcp.dev
 * therefore gives us a clean origin where /.well-known/* can live alongside
 * /mcp, /authorize and /token without colliding with the main site's own
 * well-known handlers.
 *
 * Also: cold-outreach-mail recipients clicking the body link land on /
 * which is the connector-hackathon landing; redirect them to /audit when
 * the Referer matches a known mail provider.
 */
export function middleware(req: NextRequest): NextResponse {
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0]

  // Mail-click redirect: only on the main production host, only on /,
  // only when Referer identifies a mail provider.
  if (host === 'patchbay-mcp.dev' && req.nextUrl.pathname === '/') {
    const referer = (req.headers.get('referer') || '').toLowerCase()
    if (referer && MAIL_REFERER.some((p) => referer.includes(p))) {
      const target = req.nextUrl.clone()
      target.pathname = '/audit'
      target.searchParams.set('src', 'mail')
      return NextResponse.redirect(target, 302)
    }
  }

  if (host !== 'demo.patchbay-mcp.dev') return NextResponse.next()

  const { pathname, search } = req.nextUrl
  if (pathname.startsWith('/demo')) return NextResponse.next()

  const target = req.nextUrl.clone()
  target.pathname = pathname === '/' ? '/demo' : '/demo' + pathname
  target.search = search
  return NextResponse.rewrite(target)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
