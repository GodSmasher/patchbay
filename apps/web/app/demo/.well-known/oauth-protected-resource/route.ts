import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Protected Resource Metadata (RFC 9728). Required for MCP servers since
 * the 2025-06-18 spec revision.
 *
 * INTENTIONALLY MALFORMED — missing `authorization_servers`, which
 * makes clients unable to discover where to negotiate tokens. This
 * trips RESOURCE-001 in audit-core.
 */
export async function GET(req: Request): Promise<Response> {
  const base = new URL(req.url).origin + '/demo/mcp'
  return NextResponse.json({
    resource: base,
    bearer_methods_supported: ['header'],
    scopes_supported: ['read', 'write', 'admin'],
  }, { headers: { 'cache-control': 'no-store' } })
}
