import { ImageResponse } from 'next/og'
import { loadLeaderboardEntry, type LeaderboardGrade } from '@/lib/leaderboard-store'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'patchbay MCP audit'

const GRADE_COLOR: Record<LeaderboardGrade, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
}

/**
 * Per-host leaderboard OG card. Big grade badge, hostname, score,
 * finding breakdown. Matches the /report/[id] card so a shared
 * leaderboard URL renders a branded preview on X / LinkedIn / Slack.
 */
export default async function Image({ params }: { params: { slug: string } }) {
  const entry = await loadLeaderboardEntry(params.slug)
  if (!entry) return genericCard()

  const color = GRADE_COLOR[entry.grade]

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
            MCP security leaderboard
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 200,
              height: 200,
              borderRadius: 28,
              backgroundColor: color,
              color: '#ffffff',
              fontSize: 128,
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            {entry.grade}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', fontSize: 52, fontWeight: 600, letterSpacing: '-0.02em', color: '#15161a', maxWidth: 820 }}>
              {entry.host}
            </div>
            <div style={{ display: 'flex', fontSize: 32, color: '#4a4a4a' }}>
              score {entry.score} / 100
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Chip label="critical" value={entry.findings.critical} tone="warn" />
          <Chip label="high" value={entry.findings.high} tone="warn" />
          <Chip label="medium" value={entry.findings.medium} tone="mid" />
          <Chip label="low" value={entry.findings.low} tone="mute" />
          <Chip label="info" value={entry.findings.info} tone="mute" />
        </div>
      </div>
    ),
    size,
  )
}

function Chip({ label, value, tone }: { label: string; value: number; tone: 'warn' | 'mid' | 'mute' }) {
  const palette = {
    warn: { bg: '#fdecec', fg: '#b2452f', border: '#e4b5a8' },
    mid: { bg: '#fff7d6', fg: '#8a5a00', border: '#e4c16a' },
    mute: { bg: '#ffffff', fg: '#6b6b6b', border: '#e8e5dd' },
  }[tone]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        padding: '14px 22px',
        borderRadius: 12,
        backgroundColor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 32, fontWeight: 700 }}>{value}</div>
      <div style={{ display: 'flex', fontSize: 16, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}

function genericCard() {
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
        <div style={{ fontSize: 52, fontWeight: 600 }}>MCP security leaderboard</div>
      </div>
    ),
    size,
  )
}
