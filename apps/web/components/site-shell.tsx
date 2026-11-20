import Link from 'next/link'
import { inter, jost } from '@/components/glow-fonts'
import { SiteHeader, GITHUB, NPM } from '@/components/site-header'

/**
 * Shared shell for the audit product pages (/audit, /scan, /docs, /blog,
 * /report, /privacy, /mcp-oauth-checklist, /leaderboard). Wraps everything
 * in the Glow theme (.glow, see globals.css). The root page is the
 * hackathon demo and deliberately does not use this shell.
 */

export { SiteHeader }

export function SiteFooter() {
  return (
    <footer className="relative z-10 mx-auto mt-10 max-w-6xl border-t border-white/10 px-5 py-10 text-sm text-ink-mute sm:px-8">
      <nav aria-label="Footer" className="grid grid-cols-2 gap-x-5 gap-y-2 sm:flex sm:flex-wrap">
        <Link href="/scan" className="hover:text-white">scan a server</Link>
        <Link href="/docs" className="hover:text-white">all checks</Link>
        <Link href="/mcp-oauth-checklist" className="hover:text-white">oauth checklist</Link>
        <Link href="/leaderboard" className="hover:text-white">leaderboard</Link>
        <Link href="/blog" className="hover:text-white">blog</Link>
        <Link href="/privacy" className="hover:text-white">privacy</Link>
        <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-white">github</a>
        <a href={NPM} target="_blank" rel="noopener noreferrer" className="hover:text-white">npm</a>
      </nav>
      <p className="mt-5">
        patchbay audit is an open source security scanner for MCP servers. MIT licensed. The CLI
        runs locally and stays free.
      </p>
    </footer>
  )
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`glow ${jost.variable} ${inter.variable}`}>
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  )
}
