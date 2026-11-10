import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'patchbay: scan any MCP server from your browser'

/**
 * OG card for /scan. Overrides the root hackathon-themed image so links to
 * the browser-scan tool preview as a product, not as a hackathon pitch.
 */
export default function Image() {
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
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em' }}>patchbay</div>
          <div style={{ fontSize: 18, color: '#6b6b6b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            MCP security scanner
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 76,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              maxWidth: 1040,
            }}
          >
            Scan any MCP server in 2 seconds.
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: '#4a4a4a', lineHeight: 1.4, maxWidth: 980 }}>
            Paste the URL. 15 checks. Letter grade. Public shareable report. No install, no account.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '20px 28px',
            borderRadius: 16,
            backgroundColor: '#ffffff',
            border: '1px solid #e8e5dd',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 78,
              height: 78,
              borderRadius: 14,
              backgroundColor: '#1d6f42',
              color: '#ffffff',
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            A+
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', fontSize: 24, color: '#15161a', fontWeight: 500 }}>
              mcp.deepwiki.com/mcp
            </div>
            <div style={{ display: 'flex', fontSize: 18, color: '#6b6b6b' }}>
              score 99 / 100 · 1 low · 1 info · scanned in 2.0s
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
