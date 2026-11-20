import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { marked } from 'marked'
import { SubscribeBox } from '@/components/subscribe-box'
import { listWeeklyReports, getWeeklyReport, type WeeklyReport } from '../../_weekly'

const WEEK_RE = /^\d{4}-W\d{2}$/

export function generateStaticParams() {
  return listWeeklyReports().map((r) => ({ week: r.slug }))
}

function loadMarkdown(slug: string): string | null {
  if (!WEEK_RE.test(slug)) return null
  const abs = join(process.cwd(), 'public', 'weekly', `${slug}.md`)
  if (!existsSync(abs)) return null
  try { return readFileSync(abs, 'utf8') } catch { return null }
}

function loadOrNotFound(slug: string): { report: WeeklyReport; markdown: string } {
  const report = getWeeklyReport(slug)
  const markdown = loadMarkdown(slug)
  if (!report || !markdown) notFound()
  return { report, markdown }
}

function reportDate(report: WeeklyReport): string {
  // Use capturedAt if present; otherwise derive Sunday of the ISO week.
  if (report.capturedAt) return report.capturedAt.slice(0, 10)
  return `${report.year}-W${String(report.week).padStart(2, '0')}`
}

export async function generateMetadata({ params }: { params: { week: string } }): Promise<Metadata> {
  const report = getWeeklyReport(params.week)
  if (!report) return { title: 'Not found' }
  const url = `/blog/weekly/${report.slug}`
  const title = `${report.title} · patchbay`
  const description = `Weekly rescan of the tracked MCP server cohort. Grade drift, per-check movement, signals from the last 7 days.`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: report.title, description, type: 'article', url, publishedTime: report.capturedAt ?? undefined },
  }
}

export default function WeeklyReportPage({ params }: { params: { week: string } }) {
  const { report, markdown } = loadOrNotFound(params.week)

  // Trusted content: the markdown is produced by our own
  // scripts/generate-weekly-rescan.ts from committed bench aggregates. We
  // still ask marked to parse synchronously so there is no streaming
  // boundary in the SSR path.
  const html = marked.parse(markdown, { async: false }) as string

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: report.title,
    description: `Weekly rescan of the tracked MCP server cohort — week ${report.week}, ${report.year}.`,
    datePublished: report.capturedAt ?? undefined,
    url: `https://patchbay-mcp.dev/blog/weekly/${report.slug}`,
    mainEntityOfPage: `https://patchbay-mcp.dev/blog/weekly/${report.slug}`,
    author: { '@type': 'Organization', name: 'patchbay', url: 'https://patchbay-mcp.dev/scan' },
    publisher: { '@type': 'Organization', name: 'patchbay', url: 'https://patchbay-mcp.dev/scan' },
  }

  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/scan" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <Link href="/blog" className="hover:text-ink">blog</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">weekly</span>
        </nav>

        <div className="mb-2 flex items-baseline gap-3 text-sm text-ink-mute">
          <span className="rounded bg-paper-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
            Weekly · W{report.week}
          </span>
          <time dateTime={report.capturedAt ?? `${report.year}-01-01`}>{reportDate(report)}</time>
        </div>

        <article
          className="prose-weekly max-w-none text-ink-soft leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <SubscribeBox page={`/blog/weekly/${report.slug}`} />
      </div>
    </main>
  )
}
