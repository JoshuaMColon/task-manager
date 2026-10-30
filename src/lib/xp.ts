import { addDays, addMonths, isoDow } from './dates'
import type { Priority, Recurrence } from './types'

/**
 * Game rules. These mirror the SQL in supabase/migrations (xplan.level_threshold,
 * xplan.level_for, xplan.xp_for, xplan.next_due). The database is the source of truth;
 * the client uses these for optimistic UI and the offline/local mode.
 */
export const BASE_XP: Record<Priority, number> = { 1: 10, 2: 20, 3: 35, 4: 50 }
export const DAILY_XP_CAP = 30

export function xpFor(priority: Priority, onTime: boolean): number {
  const base = BASE_XP[priority]
  return base + (onTime ? Math.floor(base / 2) : 0)
}

/** Total XP needed to reach `level` (level 1 = 0, level 2 = 100, then +50 per level). */
export function levelThreshold(level: number): number {
  const n = Math.max(level, 1) - 1
  return 25 * n * n + 75 * n
}

export function levelFor(totalXp: number): number {
  if (totalXp <= 0) return 1
  let n = Math.floor((-75 + Math.sqrt(5625 + 100 * totalXp)) / 50)
  while (levelThreshold(n + 2) <= totalXp) n++
  while (n > 0 && levelThreshold(n + 1) > totalXp) n--
  return n + 1
}

export interface LevelProgress {
  level: number
  floor: number
  next: number
  into: number
  needed: number
  pct: number
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelFor(totalXp)
  const floor = levelThreshold(level)
  const next = levelThreshold(level + 1)
  const into = totalXp - floor
  const needed = next - floor
  return { level, floor, next, into, needed, pct: Math.max(0, Math.min(1, into / needed)) }
}

const TITLES: [number, string][] = [
  [30, 'Legend'],
  [20, 'Mythic'],
  [15, 'Champion'],
  [10, 'Elite'],
  [6, 'Veteran'],
  [3, 'Adventurer'],
  [1, 'Rookie'],
]
export function rankTitle(level: number): string {
  return TITLES.find(([min]) => level >= min)?.[1] ?? 'Rookie'
}

export function nextDue(rule: Recurrence, step: number, from: string): string {
  const s = Math.max(step || 1, 1)
  switch (rule) {
    case 'daily':
      return addDays(from, s)
    case 'weekly':
      return addDays(from, 7 * s)
    case 'monthly':
      return addMonths(from, s)
    case 'yearly':
      return addMonths(from, 12 * s)
    case 'weekdays': {
      let d = addDays(from, 1)
      while (isoDow(d) > 5) d = addDays(d, 1)
      return d
    }
  }
}

/** Next occurrence after completing a repeating quest: always strictly after today. */
export function nextOccurrence(rule: Recurrence, step: number, due: string, today: string): string {
  let next = nextDue(rule, step, due)
  for (let i = 0; next <= today && i < 1000; i++) next = nextDue(rule, step, next)
  return next
}

export const PRIORITY_META: Record<Priority, { label: string; short: string; rarity: string }> = {
  4: { label: 'Urgent', short: 'P1', rarity: 'Epic' },
  3: { label: 'High', short: 'P2', rarity: 'Rare' },
  2: { label: 'Normal', short: 'P3', rarity: 'Uncommon' },
  1: { label: 'Low', short: 'P4', rarity: 'Common' },
}

export function recurrenceLabel(rule: Recurrence | null, step = 1): string {
  if (!rule) return ''
  if (rule === 'weekdays') return 'Weekdays'
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[rule]
  if (step <= 1) return { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[rule]
  return `Every ${step} ${unit}s`
}

/** CSS colour per priority (skin-aware variables). */
export const PRIORITY_COLOR: Record<Priority, string> = { 4: 'var(--p1)', 3: 'var(--p2)', 2: 'var(--p3)', 1: 'var(--muted)' }
