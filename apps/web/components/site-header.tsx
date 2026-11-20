'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const NAV = [
  { href: '/scan', label: 'scan' },
  { href: '/docs', label: 'checks' },
  { href: '/mcp-oauth-checklist', label: 'checklist' },
  { href: '/leaderboard', label: 'leaderboard' },
  { href: '/blog', label: 'blog' },
]
export const GITHUB = 'https://github.com/GodSmasher/patchbay'
export const NPM = 'https://www.npmjs.com/package/@patchbay-nebius/agent'

export function SiteHeader() {
  const path = usePathname() ?? ''
  const isOn = (href: string) => path === href || path.startsWith(href + '/')

  return (
    <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-5 sm:px-8">
      {/* The root page is the hackathon demo, so the audit wordmark points at /audit. */}
      <Link href="/audit" className="g-glass g-pill flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:text-white">
        <span aria-hidden="true" className="g-dot" />
        patchbay audit
      </Link>

      <nav aria-label="Main" className="g-glass g-pill hidden items-center gap-9 px-10 py-3 text-[13px] text-ink-soft md:flex">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={isOn(n.href) ? 'page' : undefined}
            className={
              isOn(n.href)
                ? 'text-white underline decoration-[#ff6a2b] underline-offset-[6px]'
                : 'hover:text-white'
            }
          >
            {n.label}
          </Link>
        ))}
        <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-white">
          github
        </a>
      </nav>

      <div className="flex items-center gap-2">
        <Link href="/early-access" className="g-btn g-btn-w hidden sm:inline-flex">
          join waitlist
        </Link>
        <details className="g-menu md:hidden">
          <summary
            aria-label="Menu"
            className="relative z-[60] flex h-11 w-11 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-full border border-white/10 bg-white/5"
          >
            <span className="block h-[1.5px] w-4 bg-ink" />
            <span className="block h-[1.5px] w-4 bg-ink" />
          </summary>
          <div className="g-menu-panel">
            <nav aria-label="Main" className="flex flex-col">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="font-display py-2 text-5xl tracking-tight text-ink">
                  {n.label}
                </a>
              ))}
              <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="font-display py-2 text-5xl tracking-tight text-ink-mute">
                github ↗
              </a>
            </nav>
            <a href="/early-access" className="g-btn g-btn-w mt-auto py-4">join waitlist</a>
          </div>
        </details>
      </div>
    </header>
  )
}
