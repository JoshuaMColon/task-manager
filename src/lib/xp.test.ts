import { describe, expect, it } from 'vitest'
import { levelFor, levelProgress, levelThreshold, nextDue, nextOccurrence, rankTitle, xpFor } from './xp'

describe('xp rules (mirror xplan SQL)', () => {
  it('awards base XP by priority with a 50% on-time bonus', () => {
    expect(xpFor(1, false)).toBe(10)
    expect(xpFor(2, true)).toBe(30)
    expect(xpFor(3, true)).toBe(52)
    expect(xpFor(4, false)).toBe(50)
    expect(xpFor(4, true)).toBe(75)
  })
  it('uses the same level curve as xplan.level_for', () => {
    expect(levelThreshold(1)).toBe(0)
    expect(levelThreshold(2)).toBe(100)
    expect(levelThreshold(3)).toBe(250)
    for (const [xp, lvl] of [[0, 1], [99, 1], [100, 2], [249, 2], [250, 3], [10000, 19]]) expect(levelFor(xp)).toBe(lvl)
    for (let l = 1; l < 60; l++) {
      expect(levelFor(levelThreshold(l))).toBe(l)
      expect(levelFor(levelThreshold(l + 1) - 1)).toBe(l)
    }
  })
  it('reports progress inside a level', () => {
    expect(levelProgress(175)).toMatchObject({ level: 2, into: 75, needed: 150, pct: 0.5 })
    expect(rankTitle(1)).toBe('Rookie')
    expect(rankTitle(10)).toBe('Elite')
  })
  it('computes recurrence like xplan.next_due', () => {
    expect(nextDue('daily', 1, '2026-10-30')).toBe('2026-10-31')
    expect(nextDue('weekdays', 1, '2026-10-30')).toBe('2026-11-02')
    expect(nextDue('weekly', 2, '2026-10-30')).toBe('2026-11-13')
    expect(nextDue('monthly', 1, '2026-01-31')).toBe('2026-02-28')
    expect(nextDue('yearly', 1, '2028-02-29')).toBe('2029-02-28')
  })
  it('skips missed occurrences so the next one is after today', () => {
    expect(nextOccurrence('daily', 1, '2026-10-20', '2026-10-30')).toBe('2026-10-31')
    expect(nextOccurrence('weekly', 1, '2026-10-01', '2026-10-30')).toBe('2026-11-05')
  })
})
