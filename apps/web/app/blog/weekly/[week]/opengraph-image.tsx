import { ImageResponse } from 'next/og'
import { getWeeklyReport } from '../../_weekly'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'patchbay weekly rescan report'

/**
 * OG card for a weekly rescan report. Shows the week number, the H1 title
 * from the markdown, and a short tagline. We don't bake the severity
 * numbers into the image at generation time because this image is rendered
 * at request time from the already-synced index and should not have to
 * re-parse the full markdown for stats.
 */
export default function Image({ params }: { params: { week: string } }) {
  const report = getWeeklyReport(params.week)
  const title = report?.title ?? `Weekly Rescan Report — ${params.week}`
  const datePart = report?.capturedAt?.slice(0, 10) ?? params.week

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          backgroundColor: '#fbfaf7',
          color: '#15161a',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em' }}>patchbay</div>
          <div style={{ fontSize: 18, color: '#6b6b6b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Weekly rescan · {params.week}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              maxWidth: 1040,
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: '#4a4a4a', lineHeight: 1.4, maxWidth: 1000 }}>
            Cohort scan of public MCP servers. Severity drift, per-check movement, signals.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 18, color: '#6b6b6b' }}>patchbay-mcp.dev/blog/weekly/{params.week}</div>
          <div style={{ fontSize: 18, color: '#6b6b6b' }}>{datePart}</div>
        </div>
      </div>
    ),
    size,
  )
}
