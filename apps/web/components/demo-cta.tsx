import Link from 'next/link'

/**
 * "See this finding live on the demo server" CTA for /docs/<id> pages.
 *
 * The demo server at demo.patchbay-mcp.dev ships every check in DEMO_FIRES
 * as an intentional bug, so a reader of a check doc can scan it in two
 * seconds and see the exact Finding this page describes. Some checks need
 * extra opt-in flags (headless OAuth battery, tool-call probing).
 */

const HEADLESS_OAUTH = new Set(['pkce-001', 'pkce-002', 'implicit-001', 'redirect-002'])
const TOOL_CALLS = new Set(['poisoning-003'])

const DEMO_FIRES = new Set([
  'auth-001',
  'auth-003',
  'resource-001',
  'scope-001',
  'poisoning-001',
  'poisoning-002',
  'poisoning-003',
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
  const flags: string[] = []
  if (HEADLESS_OAUTH.has(id)) flags.push('--probe-headless-oauth')
  if (TOOL_CALLS.has(id)) flags.push('--probe-tool-calls')
  const flagStr = flags.length ? ' ' + flags.join(' ') : ''
  const cmd = `npx -y @patchbay-nebius/agent audit https://demo.patchbay-mcp.dev/mcp${flagStr}`

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
      {flags.length > 0 && (
        <p className="mt-2 text-xs text-ink-mute">
          The {flags.map((f, i) => <span key={f}><code>{f}</code>{i < flags.length - 1 ? ' and ' : ''}</span>)}{' '}
          flag{flags.length > 1 ? 's are' : ' is'} opt-in because {HEADLESS_OAUTH.has(id) ? 'crafted authorize requests' : 'tool invocation'} {HEADLESS_OAUTH.has(id) && TOOL_CALLS.has(id) ? 'and tool invocation have ' : 'has '}
          side effects; safe against our demo, do not point at production servers you don&apos;t own.
        </p>
      )}
    </section>
  )
}
