import Link from 'next/link'
import { DOCS } from '@/app/docs/_data'

/**
 * Static content below the /scan form. The form itself is a client component
 * with two sentences of text, which gives search engines nothing to index.
 * Everything here is server-rendered.
 */

// Checks the hosted scan cannot run, with the reason shown to the reader.
const CLI_ONLY: Record<string, string> = {
  'secret-001': 'needs the source directory',
  'secret-002': 'needs the source directory',
  'auth-006': 'opt-in probe',
  'audience-001': 'opt-in probe, needs your token',
  'manifest-001': 'needs a pinned earlier run',
}

const GROUPS: { title: string; prefixes: string[] }[] = [
  { title: 'Authentication and OAuth', prefixes: ['auth-', 'audience-', 'redirect-'] },
  { title: 'Scopes', prefixes: ['scope-'] },
  { title: 'Transport', prefixes: ['transport-'] },
  { title: 'Secrets', prefixes: ['secret-'] },
  { title: 'Tool manifest', prefixes: ['manifest-'] },
]

export const SCAN_FAQ: { q: string; a: string }[] = [
  {
    q: 'What does the scan send to my server?',
    a: 'An MCP initialize request and a tools/list request, plus requests for the OAuth metadata documents under /.well-known. It also sends one request with an unexpected Origin header. If the server publishes a token endpoint it sends two more requests that compare how it treats localhost and 127.0.0.1. It does not call any tool.',
  },
  {
    q: 'How is the grade calculated?',
    a: 'Every server starts at 100. A critical finding costs 30 points, a high finding 15, a medium finding 5 and a low finding 1. Info findings cost nothing. 95 and above is an A+, 85 an A, 75 a B, 60 a C, 40 a D and anything below is an F.',
  },
  {
    q: 'What if my server requires a login?',
    a: 'Then the scan only sees what is public: the transport and the OAuth metadata. A good grade in that case means the public surface looks right. It says nothing about what happens after authentication.',
  },
  {
    q: 'Does a good grade mean the server is safe?',
    a: 'No. It means the checks that ran did not find a problem. The scan does not review what the tools do, how the server handles data or whether its dependencies are up to date.',
  },
  {
    q: 'Who can see the report?',
    a: 'Anyone with the link. Reports are public and kept for 90 days. Only scan servers that are already reachable from the internet.',
  },
  {
    q: 'Can I run this in CI or against localhost?',
    a: 'Yes, with the open source CLI. It runs on your machine, reaches localhost and can fail a build on findings above a severity you choose.',
  },
]

export function ScanInfo() {
  const checks = DOCS.filter((d) => d.id !== 'check-crashed' && d.id !== 'probe-001')

  return (
    <div className="bg-paper text-ink px-6 pb-20">
      <div className="mx-auto max-w-2xl space-y-16">
        <section aria-labelledby="scan-checks">
          <h2 id="scan-checks" className="text-2xl font-semibold text-ink">
            What the scanner checks
          </h2>
          <p className="mt-3 text-ink-soft">
            patchbay audit looks at how an MCP server handles authentication, OAuth 2.1 metadata,
            scopes and transport. Each finding links to an explanation and a fix. Checks marked
            CLI need something a URL alone cannot provide, so they only run in the{' '}
            <a
              href="https://github.com/GodSmasher/patchbay"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-ink"
            >
              open source CLI
            </a>
            .
          </p>

          <div className="mt-8 space-y-8">
            {GROUPS.map((g) => {
              const items = checks.filter((c) => g.prefixes.some((p) => c.id.startsWith(p)))
              if (items.length === 0) return null
              return (
                <div key={g.title}>
                  <h3 className="text-sm uppercase tracking-wide text-ink-mute">{g.title}</h3>
                  <ul className="mt-3 divide-y divide-paper-line border-y border-paper-line">
                    {items.map((c) => (
                      <li key={c.id} className="flex items-baseline justify-between gap-4 py-3">
                        <Link href={`/docs/${c.id}`} className="text-ink-soft hover:text-ink">
                          {c.title}
                        </Link>
                        <span className="shrink-0 text-right font-mono text-xs text-ink-mute">
                          {c.id.toUpperCase()}
                          {CLI_ONLY[c.id] ? <span className="block">CLI: {CLI_ONLY[c.id]}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="scan-data">
          <h2 id="scan-data" className="text-2xl font-semibold text-ink">
            What scans of public MCP servers show
          </h2>
          <p className="mt-3 text-ink-soft">
            Snapshot from 2026-11-06: 277 public MCP server URLs, scanned without credentials.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded border border-paper-line bg-paper-line sm:grid-cols-4">
            {[
              ['264', 'servers reachable'],
              ['55', 'answered without authentication'],
              ['138', 'had at least one finding'],
              ['76', 'missing resource indicators in OAuth metadata'],
            ].map(([n, label]) => (
              <div key={label} className="flex flex-col bg-paper-card p-4">
                <dt className="order-2 text-xs text-ink-mute">{label}</dt>
                <dd className="text-2xl font-semibold text-ink">{n}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-ink-soft">
            Six of the servers that answered without authentication were rated critical because
            they also exposed tools that can write or change data. Three of those six are still
            under manual review. More in{' '}
            <Link href="/blog/state-of-mcp-auth-nov-2026" className="underline underline-offset-4 hover:text-ink">
              the state of MCP auth
            </Link>{' '}
            and on the{' '}
            <Link href="/blog" className="underline underline-offset-4 hover:text-ink">
              blog
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="scan-faq">
          <h2 id="scan-faq" className="text-2xl font-semibold text-ink">
            Questions
          </h2>
          <dl className="mt-6 space-y-6">
            {SCAN_FAQ.map((f) => (
              <div key={f.q}>
                <dt className="font-medium text-ink">{f.q}</dt>
                <dd className="mt-1 text-ink-soft">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}
