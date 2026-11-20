import type { CSSProperties } from 'react'

/** Decorative glowing shape. Position and size it with className. */
export function GlowShape({
  className = '',
  delay = 0,
  hue = 0,
  style,
}: {
  className?: string
  delay?: number
  hue?: number
  style?: CSSProperties
}) {
  const d = { animationDelay: `${delay}s` }
  return (
    <div
      aria-hidden="true"
      className={`g-shape ${className}`}
      style={{ ...d, ...(hue ? { filter: `hue-rotate(${hue}deg)` } : {}), ...style }}
    >
      <div className="g-blob g-soft" style={d} />
      <div className="g-blob" style={d} />
    </div>
  )
}

export const SEV_CLASS: Record<string, string> = {
  critical: 'g-sev g-sev-critical',
  high: 'g-sev g-sev-high',
  medium: 'g-sev g-sev-medium',
  low: 'g-sev g-sev-low',
  info: 'g-sev g-sev-info',
}

export function gradeClass(grade: string) {
  const letter = grade.trim().charAt(0).toUpperCase()
  return `g-grade g-grade-${'ABCDF'.includes(letter) ? letter : 'F'}`
}
