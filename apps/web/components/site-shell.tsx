import Link from 'next/link'

/**
 * Shared header and footer for the audit product pages (/scan, /docs, /blog,
 * /report, /privacy). The root page is the hackathon demo and deliberately
 * does not use this shell, so the wordmark points at /scan.
 */

const NAV = [
  { href: '/scan', label: 'Scan' },
  { href: '/docs', label: 'Checks' },
  { href: '/mcp-oauth-checklist', label: 'Checklist' },
  { href: '/blog', label: 'Blog' },
]

const GITHUB = 'https://github.com/GodSmasher/patchbay'
const NPM = 'https://www.npmjs.com/package/@patchbay-nebius/agent'

export function SiteHeader() {
  return (
    <header className="border-b border-paper-line bg-paper text-ink">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4">
        <Link href="/scan" className="font-semibold tracking-tight text-ink hover:opacity-80">
          patchbay <span className="font-normal text-ink-mute">audit</span>
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-soft">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-ink">
              {n.label}
            </Link>
          ))}
          <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-paper-line bg-paper text-ink">
      <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-ink-mute">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/scan" className="hover:text-ink">Scan a server</Link>
          <Link href="/docs" className="hover:text-ink">All checks</Link>
          <Link href="/mcp-oauth-checklist" className="hover:text-ink">OAuth checklist</Link>
          <Link href="/blog" className="hover:text-ink">Blog</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-ink">GitHub</a>
          <a href={NPM} target="_blank" rel="noopener noreferrer" className="hover:text-ink">npm</a>
        </nav>
        <p className="mt-4">
          patchbay audit is an open source security scanner for MCP servers. MIT licensed. The CLI
          runs locally and stays free.
        </p>
      </div>
    </footer>
  )
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  )
}
