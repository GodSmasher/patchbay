import { NextResponse } from 'next/server'
import { gradeColor, letterGrade, score, type LetterGrade } from '@patchbay-nebius/audit-core'
import { loadLatestForTarget } from '@/lib/report-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/badge/<target>.svg
 *
 * `<target>` is the MCP endpoint URL that was audited (percent-encoded).
 * Looks up the most recent report for that target and renders a letter-
 * grade badge as inline SVG. Shields.io-style layout so it blends in on
 * READMEs and release notes.
 *
 * If no report exists for the target yet, returns a greyed-out "no scan"
 * badge so authors can embed the markdown now and it fills in after the
 * first --publish.
 */
export async function GET(_req: Request, { params }: { params: { key: string[] } }): Promise<Response> {
  const raw = (params.key ?? []).join('/')
  const target = decodeURIComponent(raw.replace(/\.svg$/, ''))

  const entry = await loadLatestForTarget(target)
  let grade: LetterGrade | null = null
  let numScore: number | null = null
  if (entry) {
    numScore = score(entry.summary as Record<import('@patchbay-nebius/audit-core').Severity, number>)
    grade = letterGrade(numScore)
  }

  const svg = renderBadge({ grade, numScore })
  return new NextResponse(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      // Short cache so badges update within minutes of a fresh --publish,
      // but long enough that we do not get hammered by README re-renders.
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  })
}

function renderBadge({ grade, numScore }: { grade: LetterGrade | null; numScore: number | null }): string {
  const leftText = 'patchbay'
  const rightText = grade && numScore !== null ? `${grade} (${numScore})` : 'no scan yet'
  const rightColor = grade ? gradeColor(grade) : '#525252'

  const leftW = textWidth(leftText) + 12
  const rightW = textWidth(rightText) + 12
  const totalW = leftW + rightW

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${leftText}: ${rightText}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="m"><rect width="${totalW}" height="20" rx="3" fill="#fff"/></mask>
  <g mask="url(#m)">
    <rect width="${leftW}" height="20" fill="#333"/>
    <rect x="${leftW}" width="${rightW}" height="20" fill="${rightColor}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${leftW / 2}" y="14">${escapeXml(leftText)}</text>
    <text x="${leftW + rightW / 2}" y="14">${escapeXml(rightText)}</text>
  </g>
</svg>`
}

// Rough monospace-ish width estimate for Verdana 11px, in SVG units.
function textWidth(text: string): number {
  return Math.round(text.length * 6.5)
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
