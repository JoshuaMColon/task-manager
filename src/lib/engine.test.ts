import { describe, expect, it } from 'vitest'
import { complete, computeStats, emptyState, newTask, seedDemo, streaks, uncomplete } from './engine'
import { addDays, toISODate } from './dates'
import { levelFor, levelThreshold } from './xp'

const NOW = new Date(2026, 9, 30, 14, 0)
const TODAY = toISODate(NOW)

describe('local game engine', () => {
  it('awards XP once, spawns the next repeat and reverses on undo', () => {
    const t = newTask({ title: 'Stretch', priority: 2, due_date: TODAY, recurrence: 'daily' }, NOW)
    let s = { ...emptyState(), tasks: [t] }
    s = complete(s, t.id, NOW)
    const done = s.tasks.find((x) => x.id === t.id)!
    expect(done).toMatchObject({ status: 'done', xp_awarded: 30, on_time: true })
    expect(s.tasks.find((x) => x.spawned_from === t.id)).toMatchObject({ status: 'open', due_date: addDays(TODAY, 1) })
    expect(computeStats(s, NOW)).toMatchObject({ total_xp: 30, done: 1, open: 1, done_today: 1, xp_today: 30 })
    expect(s.achievements.map((a) => a.code)).toContain('first_quest')
    // Completing twice is a no-op.
    expect(complete(s, t.id, NOW)).toBe(s)
    s = uncomplete(s, t.id, NOW)
    expect(s.tasks).toHaveLength(1)
    expect(computeStats(s, NOW).total_xp).toBe(0)
  })
  it('gives late quests base XP only', () => {
    const t = newTask({ title: 'Late', priority: 4, due_date: addDays(TODAY, -2) }, NOW)
    const s = complete({ ...emptyState(), tasks: [t] }, t.id, NOW)
    expect(s.tasks[0]).toMatchObject({ xp_awarded: 50, on_time: false })
  })
  it('caps XP after 30 completions a day', () => {
    let s = { ...emptyState(), tasks: Array.from({ length: 32 }, (_, i) => newTask({ title: `Q${i}` }, NOW)) }
    for (const t of [...s.tasks]) s = complete(s, t.id, NOW)
    expect(s.tasks.filter((t) => t.xp_awarded > 0)).toHaveLength(30)
  })
  it('counts the combo across consecutive days', () => {
    const at = (d: number) => newTask({ title: 'x', status: 'done', completed_at: new Date(2026, 9, 30 - d, 12).toISOString() }, NOW)
    expect(streaks([at(0), at(1), at(2), at(4)], TODAY)).toEqual({ current: 3, best: 3 })
    expect(streaks([at(1), at(2)], TODAY).current).toBe(2) // today not cleared yet: combo still alive
    expect(streaks([at(2), at(3)], TODAY).current).toBe(0)
  })
  it('seeds a demo save file 15 XP short of a level-up with a live combo', () => {
    const s = seedDemo(NOW)
    const st = computeStats(s, NOW)
    expect(st.level_next - st.total_xp).toBe(15)
    expect(levelFor(st.total_xp)).toBe(st.level)
    expect(st.level_floor).toBe(levelThreshold(st.level))
    expect(st.current_streak).toBe(6)
    expect(st.open).toBe(12)
    expect(st.overdue).toBe(2)
    expect(s.achievements.length).toBeGreaterThan(4)
  })
})
