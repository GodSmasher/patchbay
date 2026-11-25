import { ImageResponse } from 'next/og'
import { DOCS } from '../_data'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'patchbay check reference'

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#84cc16',
  info: '#60a5fa',
}

/**
 * Per-check OG card. A /docs/<id> share on X / LinkedIn / Slack renders
 * with the check's own ID, title, severity and one-liner so the preview
 * carries the finding's meaning rather than a generic patchbay card.
 */
export default function Image({ params }: { params: { id: string } }) {
  const doc = DOCS.find((d) => d.id === params.id)
  if (!doc) return fallbackCard()

  const sevColor = SEV_COLOR[doc.severity] ?? '#6b6b6b'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          backgroundColor: '#fbfaf7',
          color: '#15161a',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}>patchbay</div>
          <div style={{ fontSize: 16, color: '#6b6b6b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            check reference
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 20px',
                borderRadius: 10,
                backgroundColor: sevColor,
                color: '#ffffff',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {doc.severity}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 36,
                fontWeight: 600,
                color: '#4a4a4a',
                fontFamily: 'ui-monospace, Menlo, monospace',
                letterSpacing: '-0.01em',
              }}
            >
              {doc.id.toUpperCase()}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 60,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: '#15161a',
              lineHeight: 1.1,
              maxWidth: 1050,
            }}
          >
            {doc.title}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              color: '#4a4a4a',
              lineHeight: 1.35,
              maxWidth: 1050,
            }}
          >
            {doc.oneLiner}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 18, color: '#6b6b6b' }}>
          <div>{doc.spec ?? 'MCP authorization spec'}</div>
          <div>patchbay-mcp.dev/docs/{doc.id}</div>
        </div>
      </div>
    ),
    size,
  )
}

function fallbackCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '72px',
          backgroundColor: '#fbfaf7',
          color: '#15161a',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 20 }}>patchbay</div>
        <div style={{ fontSize: 52, fontWeight: 600 }}>check reference</div>
      </div>
    ),
    size,
  )
}
