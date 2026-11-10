import { ImageResponse } from 'next/og'
import { loadReport } from '@/lib/report-store'
import { applyRetirements } from '@/lib/retired-checks'
import { letterGrade, score, gradeColor } from '@patchbay-nebius/audit-core'
import type { AuditReport } from '@patchbay-nebius/audit-core'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'patchbay audit report'

/**
 * Per-report OG card. Shows the target host, letter grade, score and finding
 * breakdown so every shared report URL renders its own branded preview on
 * X / LinkedIn / Slack — no more hackathon hero fallback.
 */
export default async function Image({ params }: { params: { id: string } }) {
  const entry = await loadReport(params.id)
  if (!entry) return genericCard()

  const report = applyRetirements(entry.body as AuditReport)
  const num = score(report.summary)
  const grade = letterGrade(num)
  const color = gradeColor(grade)

  let host = report.target
  try { host = new URL(report.target).hostname } catch {}

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
            MCP audit report
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
              fontSize: 112,
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            {grade}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', fontSize: 52, fontWeight: 600, letterSpacing: '-0.02em', color: '#15161a', maxWidth: 820 }}>
              {host}
            </div>
            <div style={{ display: 'flex', fontSize: 32, color: '#4a4a4a' }}>
              score {num} / 100
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Chip label="critical" value={report.summary.critical} tone="warn" />
          <Chip label="high" value={report.summary.high} tone="warn" />
          <Chip label="medium" value={report.summary.medium} tone="mid" />
          <Chip label="low" value={report.summary.low} tone="mute" />
          <Chip label="info" value={report.summary.info} tone="mute" />
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
        <div style={{ fontSize: 52, fontWeight: 600 }}>audit report</div>
        <div style={{ fontSize: 24, color: '#6b6b6b', marginTop: 16 }}>MCP security scanner</div>
      </div>
    ),
    size,
  )
}
