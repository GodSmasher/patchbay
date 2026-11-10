import type { Metadata } from 'next'
import Link from 'next/link'
import { SubscribeBox } from '@/components/subscribe-box'

const TITLE = 'MCP OAuth checklist: what a remote MCP server has to get right · patchbay'
const DESCRIPTION =
  'A checklist for the auth setup of a remote MCP server: discovery metadata, PKCE, client registration, loopback redirects, audience validation, scopes and transport. Each item says where the rule comes from and how to test it.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/mcp-oauth-checklist' },
  openGraph: { type: 'article', url: '/mcp-oauth-checklist', title: TITLE, description: DESCRIPTION, siteName: 'patchbay' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

type How = 'scan' | 'cli' | 'flag' | 'manual'

interface Item {
  title: string
  why: string
  // Where the rule comes from. Only name a spec when the wording was checked.
  basis: string
  how: How
  flag?: string
  doc?: string
  post?: string
}

interface Group {
  title: string
  intro: string
  items: Item[]
}

const GROUPS: Group[] = [
  {
    title: 'Discovery',
    intro: 'A client reads these documents before it does anything else. If they are missing or incomplete the login never starts.',
    items: [
      {
        title: 'Publish Protected Resource Metadata',
        why: 'The document under /.well-known/oauth-protected-resource names your resource identifier and the authorization servers that issue tokens for it. Clients use it to find where to log in.',
        basis: 'MCP spec, RFC 9728',
        how: 'scan',
        doc: 'resource-001',
      },
      {
        title: 'List S256 in code_challenge_methods_supported',
        why: 'Clients have to verify PKCE support from the authorization server metadata. If the field is absent they must stop before the login.',
        basis: 'MCP spec 2026-07-28',
        how: 'scan',
        doc: 'auth-003',
        post: 'mcp-pkce-missing-from-oauth-metadata',
      },
    ],
  },
  {
    title: 'Client registration',
    intro: 'An MCP client is whatever the user runs. It needs a client_id without anyone filing a ticket.',
    items: [
      {
        title: 'Offer an automatic way to register',
        why: 'Support Client ID Metadata Documents, which the current spec recommends, or keep a Dynamic Client Registration endpoint for older clients. With neither, every client has to be added by hand.',
        basis: 'MCP spec 2026-07-28',
        how: 'scan',
        doc: 'auth-005',
        post: 'mcp-dynamic-client-registration-missing',
      },
      {
        title: 'Accept loopback redirect URIs with any port',
        why: 'CLI and desktop clients listen on a local port that changes on every login. An authorization server that insists on an exact port breaks all of them.',
        basis: 'RFC 8252 §7.3',
        how: 'flag',
        flag: '--probe-dcr-loopback',
        doc: 'auth-006',
        post: 'mcp-oauth-login-hangs-loopback-redirect',
      },
      {
        title: 'Treat localhost and 127.0.0.1 the same',
        why: 'Clients use both forms. Accepting one and rejecting the other locks out every client that uses the other form.',
        basis: 'Good practice',
        how: 'scan',
        doc: 'redirect-001',
      },
    ],
  },
  {
    title: 'Tokens',
    intro: 'What the server does with a token once it arrives.',
    items: [
      {
        title: 'Validate the audience of every token',
        why: 'A token issued for another service behind the same authorization server must not work on your MCP server. Compare the aud claim with your own resource identifier and reject everything else.',
        basis: 'MCP spec, RFC 8707 §2',
        how: 'flag',
        flag: '--probe-audience=<token>',
        doc: 'audience-001',
        post: 'mcp-token-audience-validation',
      },
      {
        title: 'Accept the resource parameter',
        why: 'MCP clients send it on authorization and token requests so the authorization server can bind the token to your server. Make sure yours does not reject or ignore it.',
        basis: 'MCP spec, RFC 8707',
        how: 'manual',
      },
      {
        title: 'Do not rely on a static key alone',
        why: 'A long lived bearer token or API key with no OAuth discovery cannot be scoped, rotated per client or bound to an audience.',
        basis: 'Good practice',
        how: 'scan',
        doc: 'auth-002',
      },
    ],
  },
  {
    title: 'Exposure',
    intro: 'What anyone on the internet can reach without credentials.',
    items: [
      {
        title: 'Never expose write tools without authentication',
        why: 'A public server for read only lookups can be a deliberate choice. A server that answers tools/list without credentials and offers tools that create, send or delete is open to anyone who finds the URL.',
        basis: 'Good practice',
        how: 'scan',
        doc: 'auth-001',
      },
      {
        title: 'Serve over HTTPS only',
        why: 'Tokens and tool calls over plain HTTP can be read and changed in transit.',
        basis: 'Good practice',
        how: 'scan',
        doc: 'transport-001',
      },
      {
        title: 'Reject requests from origins you do not expect',
        why: 'This matters when browsers can reach the server. Without an origin check a web page the user visits can talk to it.',
        basis: 'Good practice',
        how: 'scan',
        doc: 'transport-002',
      },
    ],
  },
  {
    title: 'Scopes',
    intro: 'How much a single token can do.',
    items: [
      {
        title: 'Give tools their own scopes',
        why: 'With one scope for everything, a client that only needs to read gets permission to write as well.',
        basis: 'Good practice',
        how: 'scan',
        doc: 'scope-001',
      },
      {
        title: 'Separate read and write',
        why: 'Read and write tools behind the same scope cannot be granted independently.',
        basis: 'Good practice',
        how: 'scan',
        doc: 'scope-002',
      },
    ],
  },
  {
    title: 'In the repository',
    intro: 'These need the source code, so they only run in the CLI.',
    items: [
      {
        title: 'No secrets in source',
        why: 'Keys committed to the repository end up in every clone and every fork.',
        basis: 'Good practice',
        how: 'cli',
        doc: 'secret-001',
      },
      {
        title: 'Give long lived credentials a refresh path',
        why: 'A credential that sits in an environment variable forever cannot be rotated without downtime.',
        basis: 'Good practice',
        how: 'cli',
        doc: 'secret-002',
      },
    ],
  },
  {
    title: 'After launch',
    intro: 'A server changes. So does what an agent can do through it.',
    items: [
      {
        title: 'Watch your tool list for changes',
        why: 'Nothing in the spec makes a client ask the user again when a tool is added or its description changes. Pin the manifest and review every difference.',
        basis: 'Good practice',
        how: 'cli',
        doc: 'manifest-001',
        post: 'mcp-tools-change-after-approval',
      },
    ],
  },
]

const HOW_LABEL: Record<How, string> = {
  scan: 'Browser scan and CLI',
  cli: 'CLI',
  flag: 'CLI with flag',
  manual: 'Check by hand',
}

const A = 'underline underline-offset-4 hover:text-ink'

const total = GROUPS.reduce((n, g) => n + g.items.length, 0)

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'MCP OAuth checklist',
  description: DESCRIPTION,
  numberOfItems: total,
  itemListElement: GROUPS.flatMap((g) => g.items).map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.title,
    description: it.why,
  })),
}

export default function ChecklistPage() {
  return (
    <main className="bg-paper text-ink px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold text-ink">MCP OAuth checklist</h1>
        <p className="mt-4 text-lg text-ink-soft">
          {total} things to get right in the auth setup of a remote MCP server. Each item says where
          the rule comes from and how you can test it.
        </p>
        <p className="mt-4 text-ink-soft">
          Items marked with the MCP spec refer to the authorization spec in revision 2026-07-28.
          Everything marked as good practice is not required by a standard. It is what we look for
          when we audit a server. You can run most of the list against your own server with the{' '}
          <Link href="/scan" className={A}>
            browser scan
          </Link>{' '}
          or the open source CLI:
        </p>
        <pre className="mt-4 overflow-x-auto rounded border border-paper-line bg-paper p-4 text-sm">
          <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp</code>
        </pre>

        <div className="mt-12 space-y-14">
          {GROUPS.map((g) => (
            <section key={g.title} aria-labelledby={`g-${g.title}`}>
              <h2 id={`g-${g.title}`} className="text-xl font-semibold text-ink">
                {g.title}
              </h2>
              <p className="mt-2 text-ink-soft">{g.intro}</p>
              <ul className="mt-6 space-y-4">
                {g.items.map((it) => (
                  <li key={it.title} className="rounded border border-paper-line bg-paper-card p-5">
                    <div className="flex gap-3">
                      <span aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 rounded-sm border border-ink-mute" />
                      <div className="min-w-0">
                        <h3 className="font-medium text-ink">{it.title}</h3>
                        <p className="mt-1 text-ink-soft">{it.why}</p>
                        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-mute">
                          <div className="flex gap-1">
                            <dt>Source:</dt>
                            <dd>{it.basis}</dd>
                          </div>
                          <div className="flex gap-1">
                            <dt>Test:</dt>
                            <dd>
                              {HOW_LABEL[it.how]}
                              {it.flag ? <code className="ml-1">{it.flag}</code> : null}
                            </dd>
                          </div>
                        </dl>
                        {(it.doc || it.post) && (
                          <p className="mt-3 text-sm text-ink-soft">
                            {it.doc && (
                              <Link href={`/docs/${it.doc}`} className={A}>
                                {it.doc.toUpperCase()}: what it means and how to fix it
                              </Link>
                            )}
                            {it.doc && it.post ? <span className="mx-2 text-ink-mute">·</span> : null}
                            {it.post && (
                              <Link href={`/blog/${it.post}`} className={A}>
                                Full write-up
                              </Link>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-16 rounded border border-paper-line bg-paper-card p-6">
          <h2 className="text-lg font-semibold text-ink">Run the list against your server</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Paste the URL and get a report with a grade in a few seconds. Free, no account. The
            items marked CLI need the command line tool.
          </p>
          <Link href="/scan" className="mt-4 inline-block rounded bg-ink px-4 py-2 font-medium text-paper hover:opacity-90">
            Scan a server
          </Link>
        </section>

        <SubscribeBox page="/mcp-oauth-checklist" />
      </div>
    </main>
  )
}
