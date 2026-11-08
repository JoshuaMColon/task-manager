import { addDays, formatLongDay, toISODate } from './dates'
import type { Task } from './types'

export type ViewId = 'hq' | 'today' | 'upcoming' | 'inbox' | 'overdue' | 'log' | 'trophies' | 'project'

export interface Group {
  key: string
  label: string
  tasks: Task[]
  tone?: 'danger'
}

// YYYY-MM-DD sorts chronologically as text. A missing date sorts last ('9999')
// so an undated quest never jumps ahead of a scheduled one. Then time, then
// priority (4 is urgent, so higher first), then older created_at.
const byTime = (a: Task, b: Task) =>
  (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
  (a.due_time ?? '99').localeCompare(b.due_time ?? '99') ||
  b.priority - a.priority ||
  a.created_at.localeCompare(b.created_at)

const byPriority = (a: Task, b: Task) => b.priority - a.priority || byTime(a, b)

export const isOpen = (t: Task) => t.status === 'open'
export const isOverdue = (t: Task, today: string) => isOpen(t) && !!t.due_date && t.due_date < today
export const isToday = (t: Task, today: string) => isOpen(t) && t.due_date === today
export const doneOn = (t: Task, day: string) => t.status === 'done' && !!t.completed_at && toISODate(new Date(t.completed_at)) === day

export function matches(t: Task, q: string, projectName?: string): boolean {
  if (!q) return true
  const s = q.toLowerCase()
  return t.title.toLowerCase().includes(s) || t.notes.toLowerCase().includes(s) || t.tags.some((g) => g.includes(s.replace(/^#/, ''))) || !!projectName?.toLowerCase().includes(s.replace(/^@/, ''))
}

// Each view is a pure slice of the same task array. Empty groups are dropped
// so the page doesn't render a heading over nothing. HQ and Today share the
// overdue-then-today grouping; "cleared today" is only on the Daily missions page.
export function groupsFor(view: ViewId, tasks: Task[], today: string, projectId?: string): Group[] {
  const open = tasks.filter(isOpen)
  switch (view) {
    case 'hq':
    case 'today': {
      const overdue = open.filter((t) => isOverdue(t, today)).sort(byTime)
      const todays = open.filter((t) => isToday(t, today)).sort((a, b) => (a.due_time ?? '99').localeCompare(b.due_time ?? '99') || byPriority(a, b))
      const cleared = tasks.filter((t) => doneOn(t, today)).sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
      return [
        { key: 'overdue', label: 'Overdue', tasks: overdue, tone: 'danger' as const },
        { key: 'today', label: 'Daily missions', tasks: todays },
        { key: 'cleared', label: 'Cleared today', tasks: view === 'today' ? cleared : [] },
      ].filter((g) => g.tasks.length)
    }
    case 'upcoming': {
      // The next 7 calendar days, each as its own group, then one Later bucket.
      // Days with nothing scheduled are omitted.
      const groups: Group[] = []
      for (let i = 1; i <= 7; i++) {
        const d = addDays(today, i)
        groups.push({ key: d, label: formatLongDay(d, today), tasks: open.filter((t) => t.due_date === d).sort(byTime) })
      }
      const later = open.filter((t) => t.due_date && t.due_date > addDays(today, 7)).sort(byTime)
      return [...groups.filter((g) => g.tasks.length), ...(later.length ? [{ key: 'later', label: 'Later', tasks: later }] : [])]
    }
    case 'inbox':
      return [{ key: 'inbox', label: 'No due date', tasks: open.filter((t) => !t.due_date).sort(byPriority) }].filter((g) => g.tasks.length)
    case 'overdue':
      return [{ key: 'overdue', label: 'Overdue', tasks: open.filter((t) => isOverdue(t, today)).sort(byTime), tone: 'danger' as const }].filter((g) => g.tasks.length)
    case 'project': {
      const mine = open.filter((t) => t.project_id === projectId)
      return [
        { key: 'dated', label: 'Scheduled', tasks: mine.filter((t) => t.due_date).sort(byTime) },
        { key: 'undated', label: 'Someday', tasks: mine.filter((t) => !t.due_date).sort(byPriority) },
      ].filter((g) => g.tasks.length)
    }
    case 'log': {
      // Group by the local calendar day of completed_at, newest day first.
      // Cloud mode only loads the latest 400 completions, so the log is that window there.
      const done = tasks.filter((t) => t.status === 'done' && t.completed_at).sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))
      const map = new Map<string, Task[]>()
      for (const t of done) {
        const d = toISODate(new Date(t.completed_at!))
        map.set(d, [...(map.get(d) ?? []), t])
      }
      return [...map.entries()].map(([d, ts]) => ({ key: d, label: formatLongDay(d, today), tasks: ts }))
    }
    default:
      return []
  }
}
