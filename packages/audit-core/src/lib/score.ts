import type { Severity } from '../types'

/**
 * Patchbay score: 0-100, higher is better. Used for the public report
 * badge (A+ down to F). Pure function over the summary counts so both
 * the CLI output and the web badge agree on the number.
 *
 * Weights (per-finding deductions from 100):
 *   critical  -30
 *   high      -15
 *   medium     -5
 *   low        -1
 *   info        0  (info findings do not reduce the score; they are
 *                   contextual, not problems)
 *
 * Floors at 0. One critical finding ~ A score of 70, two ~ 40, three ~ 10.
 * One medium or a handful of lows barely dent the grade.
 */
export const WEIGHTS: Record<Severity, number> = {
  critical: 30,
  high: 15,
  medium: 5,
  low: 1,
  info: 0,
}

export function score(summary: Record<Severity, number>): number {
  const penalty =
    summary.critical * WEIGHTS.critical +
    summary.high * WEIGHTS.high +
    summary.medium * WEIGHTS.medium +
    summary.low * WEIGHTS.low
  return Math.max(0, 100 - penalty)
}

export type LetterGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'

export function letterGrade(numericScore: number): LetterGrade {
  if (numericScore >= 95) return 'A+'
  if (numericScore >= 85) return 'A'
  if (numericScore >= 75) return 'B'
  if (numericScore >= 60) return 'C'
  if (numericScore >= 40) return 'D'
  return 'F'
}

/**
 * Colour for the badge, per grade. Kept simple so the SVG endpoint can
 * inline it without a theme lookup.
 */
export function gradeColor(grade: LetterGrade): string {
  return {
    'A+': '#16a34a', // green-600
    A: '#22c55e',    // green-500
    B: '#84cc16',    // lime-500
    C: '#eab308',    // yellow-500
    D: '#f97316',    // orange-500
    F: '#dc2626',    // red-600
  }[grade]
}
