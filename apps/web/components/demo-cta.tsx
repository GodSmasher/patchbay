import Link from 'next/link'

/**
 * "See this finding live on the demo server" CTA for /docs/<id> pages.
 *
 * The demo server at demo.patchbay-mcp.dev ships every check in DEMO_FIRES
 * as an intentional bug, so a reader of a check doc can scan it in two
 * seconds and see the exact Finding this page describes. Four of the
 * battery checks require the opt-in --probe-headless-oauth flag.
 */

const BATTERY = new Set(['pkce-001', 'pkce-002', 'implicit-001', 'redirect-002'])

const DEMO_FIRES = new Set([
  'auth-001',
  'auth-003',
  'resource-001',
  'scope-001',
  'poisoning-001',
  'poisoning-002',
  'annotations-001',
  'headers-001',
  'transport-002',
  'iss-001',
  'pkce-001',
  'pkce-002',
  'implicit-001',
  'redirect-002',
])

export function DemoCTA({ checkId }: { checkId: string }): JSX.Element | null {
  const id = checkId.toLowerCase()
  if (!DEMO_FIRES.has(id)) return null
  const needsBattery = BATTERY.has(id)
  const flag = needsBattery ? ' --probe-headless-oauth' : ''
  const cmd = `npx -y @patchbay-nebius/agent audit https://demo.patchbay-mcp.dev/mcp${flag}`

  return (
    <section className="mb-10 rounded border border-paper-line bg-paper p-5">
      <p className="text-sm text-ink-mute mb-2">
        See it live
      </p>
      <p className="text-ink-soft text-sm leading-relaxed mb-3">
        Our{' '}
        <Link href="/demo" className="text-ink underline underline-offset-4 hover:text-ink">
          demo MCP server
        </Link>{' '}
        trips {id.toUpperCase()} on purpose. Scan it and you&apos;ll see this exact
        finding with evidence and fix text.
      </p>
      <pre className="rounded border border-paper-line bg-paper p-3 text-xs overflow-x-auto">
        <code>{cmd}</code>
      </pre>
      {needsBattery && (
        <p className="mt-2 text-xs text-ink-mute">
          The <code>--probe-headless-oauth</code> flag is opt-in because it sends
          crafted authorize requests; safe against our demo, do not point it at
          production servers you don&apos;t own.
        </p>
      )}
    </section>
  )
}
