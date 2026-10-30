import { addDays, diffDays, toISODate, todayISO } from './dates'
import type { Achievement, Priority, Project, Stats, Task } from './types'
import { DAILY_XP_CAP, levelFor, levelThreshold, nextOccurrence, xpFor } from './xp'

/**
 * A pure, in-memory version of the database rules (xplan triggers + xplan_stats), used
 * when the app runs without Supabase (local mode, CI e2e) and covered by unit tests.
 */
export interface XpEvent {
  task_id: string | null
  kind: 'complete' | 'undo' | 'seed'
  xp: number
  created_at: string
}

export interface GameState {
  tasks: Task[]
  projects: Project[]
  xp: XpEvent[]
  achievements: Achievement[]
}

export const emptyState = (): GameState => ({ tasks: [], projects: [], xp: [], achievements: [] })

const localDay = (ts: string) => toISODate(new Date(ts))
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}-${Date.now()}`)

export function newTask(fields: Partial<Task> & { title: string }, now = new Date()): Task {
  const ts = now.toISOString()
  return {
    id: uid(),
    title: fields.title.trim(),
    notes: fields.notes ?? '',
    priority: fields.priority ?? 2,
    due_date: fields.due_date ?? null,
    due_time: fields.due_time ?? null,
    recurrence: fields.recurrence ?? null,
    recur_interval: fields.recur_interval ?? 1,
    project_id: fields.project_id ?? null,
    tags: [...new Set((fields.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))].sort(),
    status: fields.status ?? 'open',
    completed_at: fields.completed_at ?? null,
    xp_awarded: fields.xp_awarded ?? 0,
    on_time: fields.on_time ?? null,
    spawned_from: fields.spawned_from ?? null,
    created_at: fields.created_at ?? ts,
    updated_at: ts,
  }
}

export function totalXp(s: GameState): number {
  return s.xp.reduce((a, e) => a + e.xp, 0)
}

export function streaks(tasks: Task[], today: string): { current: number; best: number } {
  const days = [...new Set(tasks.filter((t) => t.status === 'done' && t.completed_at).map((t) => localDay(t.completed_at!)))].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  let lastRunEnd: string | null = null
  let lastRunLen = 0
  for (const d of days) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1
    prev = d
    best = Math.max(best, run)
    lastRunEnd = d
    lastRunLen = run
  }
  const current = lastRunEnd && diffDays(today, lastRunEnd) <= 1 ? lastRunLen : 0
  return { current, best }
}

/** Mirrors xplan.guard_task + xplan.after_task_change for an open -> done transition. */
export function complete(s: GameState, id: string, now = new Date()): GameState {
  const t = s.tasks.find((x) => x.id === id)
  if (!t || t.status === 'done') return s
  const today = toISODate(now)
  const onTime = t.due_date ? today <= t.due_date : null
  const rewardedToday = s.tasks.filter((x) => x.status === 'done' && x.xp_awarded > 0 && x.completed_at && localDay(x.completed_at) === today).length
  const xp = rewardedToday >= DAILY_XP_CAP ? 0 : xpFor(t.priority, !!onTime)
  const ts = now.toISOString()
  const done: Task = { ...t, status: 'done', completed_at: ts, on_time: onTime, xp_awarded: xp, updated_at: ts }
  let tasks = s.tasks.map((x) => (x.id === id ? done : x))
  if (t.recurrence && t.due_date) {
    const next = newTask({ ...t, id: undefined, status: 'open', completed_at: null, xp_awarded: 0, on_time: null, created_at: undefined, due_date: nextOccurrence(t.recurrence, t.recur_interval, t.due_date, today), spawned_from: t.id }, now)
    tasks = [...tasks, next]
  }
  const xpLog = xp ? [...s.xp, { task_id: id, kind: 'complete' as const, xp, created_at: ts }] : s.xp
  return checkAchievements({ ...s, tasks, xp: xpLog }, now)
}

export function uncomplete(s: GameState, id: string, now = new Date()): GameState {
  const t = s.tasks.find((x) => x.id === id)
  if (!t || t.status !== 'done') return s
  const ts = now.toISOString()
  const tasks = s.tasks
    .filter((x) => !(x.spawned_from === id && x.status === 'open'))
    .map((x) => (x.id === id ? { ...x, status: 'open' as const, completed_at: null, on_time: null, xp_awarded: 0, updated_at: ts } : x))
  const xpLog = t.xp_awarded ? [...s.xp, { task_id: id, kind: 'undo' as const, xp: -t.xp_awarded, created_at: ts }] : s.xp
  return { ...s, tasks, xp: xpLog }
}

export function checkAchievements(s: GameState, now = new Date()): GameState {
  const done = s.tasks.filter((t) => t.status === 'done' && t.completed_at)
  const hour = (t: Task) => new Date(t.completed_at!).getHours()
  const lvl = levelFor(totalXp(s))
  const { best } = streaks(s.tasks, toISODate(now))
  const rules: [string, boolean][] = [
    ['first_quest', done.length >= 1],
    ['quests_10', done.length >= 10],
    ['quests_50', done.length >= 50],
    ['quests_100', done.length >= 100],
    ['combo_3', best >= 3],
    ['combo_7', best >= 7],
    ['combo_30', best >= 30],
    ['level_5', lvl >= 5],
    ['level_10', lvl >= 10],
    ['on_time_10', done.filter((t) => t.on_time).length >= 10],
    ['boss_5', done.filter((t) => t.priority >= 3).length >= 5],
    ['routine_5', done.filter((t) => t.recurrence).length >= 5],
    ['early_bird', done.some((t) => hour(t) < 9)],
    ['night_owl', done.some((t) => hour(t) >= 22)],
  ]
  const have = new Set(s.achievements.map((a) => a.code))
  const fresh = rules.filter(([c, ok]) => ok && !have.has(c)).map(([code]) => ({ code, unlocked_at: now.toISOString() }))
  return fresh.length ? { ...s, achievements: [...s.achievements, ...fresh] } : s
}

/** Mirrors public.xplan_stats(). */
export function computeStats(s: GameState, now = new Date(), days = 182): Stats {
  const today = toISODate(now)
  const total = totalXp(s)
  const level = levelFor(total)
  const { current, best } = streaks(s.tasks, today)
  const recentCut = now.getTime() - 30 * 86_400_000
  const recent = s.tasks.filter((t) => new Date(t.created_at).getTime() > recentCut)
  const judged = s.tasks.filter((t) => t.status === 'done' && t.on_time !== null)
  const heat = new Map<string, number>()
  const from = addDays(today, -days)
  for (const t of s.tasks) {
    if (t.status !== 'done' || !t.completed_at) continue
    const d = localDay(t.completed_at)
    if (d >= from) heat.set(d, (heat.get(d) ?? 0) + 1)
  }
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : null)
  return {
    total_xp: total,
    level,
    level_floor: levelThreshold(level),
    level_next: levelThreshold(level + 1),
    current_streak: current,
    best_streak: best,
    done: s.tasks.filter((t) => t.status === 'done').length,
    open: s.tasks.filter((t) => t.status === 'open').length,
    overdue: s.tasks.filter((t) => t.status === 'open' && t.due_date && t.due_date < today).length,
    done_today: s.tasks.filter((t) => t.status === 'done' && t.completed_at && localDay(t.completed_at) === today).length,
    clear_rate: pct(recent.filter((t) => t.status === 'done').length, recent.length),
    on_time_pct: pct(judged.filter((t) => t.on_time).length, judged.length),
    xp_today: s.xp.filter((e) => localDay(e.created_at) === today).reduce((a, e) => a + e.xp, 0),
    today,
    heatmap: [...heat.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, n]) => ({ d, n })),
  }
}

const HISTORY_TITLES = ['Inbox zero', 'Code review', '30 min walk', 'Write standup notes', 'Refactor auth hook', 'Meal prep', 'Read 20 pages', 'Fix flaky test', 'Call mom', 'Stretch', 'Update portfolio', 'Laundry', 'Practice Spanish', 'Pay electric bill', 'Plan the week', 'Ship a small PR']

/** Mirrors public.xplan_start_demo(): a lived-in save file 15 XP short of a level-up. */
export function seedDemo(now = new Date()): GameState {
  const today = todayISO(now)
  const mk = (name: string, color: string): Project => ({ id: uid(), name, color, created_at: now.toISOString() })
  const projects = [mk('Work', '#f97316'), mk('Health', '#22c55e'), mk('Home', '#a855f7'), mk('Learning', '#0ea5e9')]
  const [work, health, home, learn] = projects.map((p) => p.id)
  const tasks: Task[] = []
  const xp: XpEvent[] = []
  for (let d = 1; d <= 34; d++) {
    if ([7, 12, 13, 20, 26, 31].includes(d)) continue
    const n = 1 + ((d * 7) % 3)
    for (let k = 0; k < n; k++) {
      const pr = (1 + ((d + k) % 4)) as Priority
      const ot = (d + k) % 5 !== 0
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, 7 + k * 4 + (d % 3), 40 + ((d * 13) % 50))
      const ts = day.toISOString()
      const gained = xpFor(pr, ot)
      const t = newTask({ title: HISTORY_TITLES[(d * 3 + k) % HISTORY_TITLES.length], priority: pr, due_date: addDays(today, ot ? -d : -d - 2), project_id: projects[(d + k) % 4].id, status: 'done', completed_at: ts, xp_awarded: gained, on_time: ot, created_at: new Date(day.getTime() - 2 * 86_400_000).toISOString() }, now)
      tasks.push(t)
      xp.push({ task_id: t.id, kind: 'seed', xp: gained, created_at: ts })
    }
  }
  const open: [string, Priority, string | null, string | null, Task['recurrence'], string | null, string[], string?][] = [
    ['Ship the XPlan case study', 4, today, '17:00', null, work, ['portfolio'], 'Screens, write-up, and a link from the portfolio.'],
    ['Morning stretch', 1, today, null, 'daily', health, ['habit']],
    ['Read 20 pages', 1, today, null, 'daily', learn, ['habit']],
    ['Water the plants', 2, today, null, 'weekly', home, []],
    ['Review pull requests', 3, addDays(today, -1), null, null, work, ['code']],
    ['Back up photos', 2, addDays(today, -3), null, null, home, []],
    ['Plan next sprint', 3, addDays(today, 1), '10:00', null, work, []],
    ['Gym: leg day', 2, addDays(today, 1), null, 'weekly', health, []],
    ['Book dentist appointment', 2, addDays(today, 3), null, null, home, ['errand']],
    ['Pay rent', 4, addDays(today, 5), null, 'monthly', home, ['bills']],
    ['Learn a new keyboard shortcut', 1, null, null, null, learn, []],
    ['Clean up desktop files', 1, null, null, null, null, []],
  ]
  for (const [title, priority, due_date, due_time, recurrence, project_id, tags, notes] of open) {
    tasks.push(newTask({ title, priority, due_date, due_time, recurrence, project_id, tags, notes }, now))
  }
  let state: GameState = { tasks, projects, xp, achievements: [] }
  const total = totalXp(state)
  const lvl = levelFor(total)
  let target = levelThreshold(lvl + 1) - 15
  if (target < total) target = levelThreshold(lvl + 2) - 15
  if (target > total) state = { ...state, xp: [...state.xp, { task_id: null, kind: 'seed', xp: target - total, created_at: new Date(now.getTime() - 86_400_000).toISOString() }] }
  return checkAchievements(state, now)
}
