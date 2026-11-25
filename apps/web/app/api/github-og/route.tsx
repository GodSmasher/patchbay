// /api/github-og — live-data OG card renderable on github.com README
// via <img src="https://patchbay-mcp.dev/api/github-og">. Pulls the
// current leaderboard snapshot and renders a 1200x630 PNG showing
// servers crawled, grade distribution, and when the snapshot was
// captured. Cached for 1 hour so the README doesn't hammer the KV
// store on every repo visit.

import { ImageResponse } from 'next/og'
import { loadLeaderboardSnapshot } from '@/lib/leaderboard-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET() {
  const snapshot = await loadLeaderboardSnapshot()
  const total = snapshot?.entries.length ?? 0
  const buckets = { A: 0, B: 0, C: 0, D: 0, F: 0 } as Record<string, number>
  if (snapshot) {
    for (const e of snapshot.entries) {
      buckets[e.grade] = (buckets[e.grade] ?? 0) + 1
    }
  }
  const dfCount = (buckets.D ?? 0) + (buckets.F ?? 0)
  const capturedAt = snapshot?.capturedAt
    ? new Date(snapshot.capturedAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 72px',
          backgroundColor: '#0d0d11',
          color: '#fbfaf7',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em', color: '#ff8a55' }}>
            patchbay
          </div>
          <div style={{ fontSize: 16, color: '#8e8e98', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            live leaderboard · sweep {capturedAt}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 36,
            fontSize: 48,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            color: '#fbfaf7',
          }}
        >
          open-source security scanner for MCP servers
        </div>

        <div style={{ display: 'flex', marginTop: 44, gap: 48 }}>
          <Stat value={total.toLocaleString()} label="public MCP servers crawled" accent="#fbfaf7" />
          <Stat
            value={(total - dfCount).toLocaleString()}
            label={`grade A — C · ${total > 0 ? Math.round(((total - dfCount) / total) * 100) : 0}%`}
            accent="#84cc16"
          />
          <Stat value={dfCount.toLocaleString()} label="carry grade D or F" accent="#ff8a55" />
        </div>

        <div style={{ display: 'flex', marginTop: 32, gap: 16 }}>
          {(['A', 'B', 'C', 'D', 'F'] as const).map((g) => (
            <GradeChip key={g} grade={g} count={buckets[g] ?? 0} />
          ))}
        </div>

        <div style={{ display: 'flex', marginTop: 'auto', fontSize: 20, color: '#8e8e98', gap: 14 }}>
          <span>$ npx -y @patchbay-nebius/agent audit &lt;url&gt;</span>
          <span style={{ color: '#4a4a52' }}>·</span>
          <span>patchbay-mcp.dev/audit</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'cache-control': 'public, max-age=3600, s-maxage=3600',
      },
    },
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: '-0.03em', color: accent, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 18, color: '#c3c3cc' }}>{label}</div>
    </div>
  )
}

const GRADE_COLOR: Record<string, { bg: string; fg: string }> = {
  A: { bg: 'rgba(34,197,94,0.18)', fg: '#4ade80' },
  B: { bg: 'rgba(132,204,22,0.18)', fg: '#a3e635' },
  C: { bg: 'rgba(234,179,8,0.18)', fg: '#facc15' },
  D: { bg: 'rgba(249,115,22,0.18)', fg: '#fb923c' },
  F: { bg: 'rgba(239,68,68,0.18)', fg: '#f87171' },
}

function GradeChip({ grade, count }: { grade: string; count: number }) {
  const c = GRADE_COLOR[grade] ?? { bg: 'rgba(255,255,255,0.08)', fg: '#c3c3cc' }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        padding: '12px 20px',
        borderRadius: 10,
        backgroundColor: c.bg,
        color: c.fg,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700 }}>{grade}</div>
      <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
    </div>
  )
}
