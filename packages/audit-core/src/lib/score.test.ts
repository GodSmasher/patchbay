import { describe, expect, it } from 'vitest'
import type { Severity } from '../types'
import { gradeColor, letterGrade, score, WEIGHTS } from './score'

function summary(partial: Partial<Record<Severity, number>>): Record<Severity, number> {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0, ...partial }
}

describe('score', () => {
  it('returns 100 for an all-clean report', () => {
    expect(score(summary({}))).toBe(100)
  })

  it('info findings do not reduce the score', () => {
    expect(score(summary({ info: 10 }))).toBe(100)
  })

  it('one critical deducts 30 points', () => {
    expect(score(summary({ critical: 1 }))).toBe(100 - WEIGHTS.critical)
  })

  it('two criticals deduct 60 points', () => {
    expect(score(summary({ critical: 2 }))).toBe(100 - 2 * WEIGHTS.critical)
  })

  it('three criticals deduct 90 points, not below 0', () => {
    expect(score(summary({ critical: 3 }))).toBe(10)
  })

  it('four criticals clamp to 0', () => {
    expect(score(summary({ critical: 4 }))).toBe(0)
  })

  it('mixed findings sum their weights', () => {
    const s = summary({ critical: 1, high: 2, medium: 3, low: 5 })
    const expected = 100 - (30 + 30 + 15 + 5)
    expect(score(s)).toBe(expected)
  })

  it('low findings barely move the grade', () => {
    expect(score(summary({ low: 5 }))).toBe(95)
  })
})

describe('letterGrade', () => {
  it('95+ is A+', () => {
    expect(letterGrade(100)).toBe('A+')
    expect(letterGrade(95)).toBe('A+')
  })
  it('85-94 is A', () => {
    expect(letterGrade(94)).toBe('A')
    expect(letterGrade(85)).toBe('A')
  })
  it('75-84 is B', () => {
    expect(letterGrade(84)).toBe('B')
    expect(letterGrade(75)).toBe('B')
  })
  it('60-74 is C', () => {
    expect(letterGrade(74)).toBe('C')
    expect(letterGrade(60)).toBe('C')
  })
  it('40-59 is D', () => {
    expect(letterGrade(59)).toBe('D')
    expect(letterGrade(40)).toBe('D')
  })
  it('below 40 is F', () => {
    expect(letterGrade(39)).toBe('F')
    expect(letterGrade(0)).toBe('F')
  })
})

describe('end-to-end grade mapping', () => {
  it('clean server -> A+', () => {
    expect(letterGrade(score(summary({})))).toBe('A+')
  })
  it('one critical -> C (70 points)', () => {
    expect(letterGrade(score(summary({ critical: 1 })))).toBe('C')
  })
  it('two criticals -> D (40 points)', () => {
    expect(letterGrade(score(summary({ critical: 2 })))).toBe('D')
  })
  it('three criticals -> F', () => {
    expect(letterGrade(score(summary({ critical: 3 })))).toBe('F')
  })
  it('one medium only -> A+ still (barely scratches)', () => {
    expect(letterGrade(score(summary({ medium: 1 })))).toBe('A+')
  })
})

describe('gradeColor', () => {
  it('returns a hex colour for every grade', () => {
    const grades = ['A+', 'A', 'B', 'C', 'D', 'F'] as const
    for (const g of grades) {
      expect(gradeColor(g)).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('A+ and A are both green', () => {
    expect(gradeColor('A+')).toMatch(/^#1/)
    expect(gradeColor('A')).toMatch(/^#2/)
  })

  it('F is red', () => {
    expect(gradeColor('F').toLowerCase()).toContain('dc2626')
  })
})
