import { ImageResponse } from 'next/og'
import { getPost } from '../_data'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'patchbay blog post'

/**
 * Per-post OG card. Overrides the root hackathon-themed card so Twitter /
 * LinkedIn / Slack previews for blog links show the post's own headline
 * and a few key data points instead of the Nebius x NVIDIA hero.
 */
export default function Image({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug)
  const title = post?.title ?? 'patchbay blog'
  const summary =
    post?.summary ?? 'MCP security scanner. Sweep data, OAuth 2.1 compliance, tool-manifest drift.'

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
            MCP security scanner
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
            {summary}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          <Stat label="servers scanned" value="277" />
          <Stat label="enforce auth" value="75%" />
          <Stat label="publish security.txt" value="6%" />
        </div>
      </div>
    ),
    size,
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '18px 26px',
        borderRadius: 14,
        backgroundColor: '#ffffff',
        border: '1px solid #e8e5dd',
        minWidth: 220,
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 14,
          color: '#8a8a8a',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', fontSize: 42, fontWeight: 600, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  )
}
