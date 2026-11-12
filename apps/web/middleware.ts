import { NextRequest, NextResponse } from 'next/server'

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
 * Request shape (external):
 *   demo.patchbay-mcp.dev/mcp                         → /demo/mcp
 *   demo.patchbay-mcp.dev/.well-known/oauth-*         → /demo/.well-known/oauth-*
 *   demo.patchbay-mcp.dev/authorize                   → /demo/authorize
 *   demo.patchbay-mcp.dev/token                       → /demo/token
 *   demo.patchbay-mcp.dev/                            → /demo
 *
 * When the request already carries the /demo prefix (direct hit on the
 * main domain), the middleware is a no-op.
 */
export function middleware(req: NextRequest): NextResponse {
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0]
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
