import { ImageResponse } from 'next/og'
import { loadLeaderboardSnapshot, type LeaderboardGrade } from '@/lib/leaderboard-store'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'patchbay MCP security leaderboard'

/**
 * Leaderboard overview OG card. Shows a grid of the top-10 grades as a
 * visual kicker (large letters, grade-coloured tiles, hostname below).
 * Falls back to a generic card when no snapshot is loaded yet.
 */
const GRADE_COLOR: Record<LeaderboardGrade, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
}

export default async function Image() {
  const snapshot = await loadLeaderboardSnapshot()
  if (!snapshot) return genericCard()

  const reachable = snapshot.entries.filter((e) => e.reachable)
  const top = reachable.slice(0, 10)
  const capturedDate = snapshot.capturedAt.slice(0, 10)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 600, letterSpacing: '-0.02em' }}>
            Top {top.length} of {reachable.length} public MCP servers
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: '#4a4a4a' }}>
            Passive OAuth 2.1 and transport audit · {capturedDate}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {top.map((e) => (
            <div
              key={e.slug}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 100,
                height: 100,
                borderRadius: 14,
                backgroundColor: GRADE_COLOR[e.grade],
                color: '#ffffff',
                fontSize: 56,
                fontWeight: 700,
                letterSpacing: '-0.03em',
              }}
            >
              {e.grade}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
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
        <div style={{ fontSize: 24, color: '#6b6b6b', marginTop: 16 }}>Passive audit of public MCP servers</div>
      </div>
    ),
    size,
  )
}
