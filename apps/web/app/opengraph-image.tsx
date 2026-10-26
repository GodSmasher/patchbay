import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'patchbay — describe an integration, get a tested connector'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Social share preview for patchbay. Rendered on the edge via Next.js
 * ImageResponse so Twitter/LinkedIn/Slack see a proper card instead of
 * a plain text link. Kept intentionally simple — one headline, one
 * subhead, three stat chips, no images (which the Edge runtime can't
 * load without extra fetches).
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
          padding: '72px 80px',
          backgroundColor: '#faf7f2',
          color: '#15110c',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.01em' }}>patchbay</div>
          <div style={{ fontSize: 20, color: '#766d5e', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Nebius × NVIDIA Hackathon
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            Describe an integration.
            <br />
            Get a connector that already passed its tests.
          </div>
          <div style={{ fontSize: 26, color: '#4a4238', lineHeight: 1.4, maxWidth: 980 }}>
            Plans the integration, reads real API docs, writes TypeScript with tests, verifies in a Nebius sandbox with the network off.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          <Stat label="green" value="90.2%" detail="core 20, 92 runs" />
          <Stat label="first-try" value="52%" detail="no repair needed" />
          <Stat label="per connector" value="$0.07" detail="Nemotron on Nebius" />
        </div>
      </div>
    ),
    size,
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '20px 28px',
        borderRadius: 16,
        backgroundColor: '#ffffff',
        border: '1px solid #e5ddcf',
        minWidth: 240,
      }}
    >
      <div style={{ fontSize: 14, color: '#8d8372', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 16, color: '#766d5e' }}>{detail}</div>
    </div>
  )
}
