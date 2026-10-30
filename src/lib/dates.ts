/** Local calendar dates as YYYY-MM-DD strings (no time zone drift). */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Like Postgres `date + interval 'n months'`: clamps to the last day of the month. */
export function addMonths(iso: string, n: number): string {
  const d = fromISODate(iso)
  const day = d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(day, last))
  return toISODate(target)
}

export function todayISO(now = new Date()): string {
  return toISODate(now)
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromISODate(a).getTime() - fromISODate(b).getTime()) / 86_400_000)
}

/** ISO weekday 1 (Mon) .. 7 (Sun). */
export function isoDow(iso: string): number {
  const d = fromISODate(iso).getDay()
  return d === 0 ? 7 : d
}

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const MONTH_DAY = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const LONG_DAY = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

export function formatTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 === 0 ? 12 : h % 12
  return m ? `${hh}:${String(m).padStart(2, '0')}${suffix}` : `${hh}${suffix}`
}

/** "Today", "Tomorrow", "Yesterday", "Fri", "Nov 12". */
export function formatDue(iso: string, today = todayISO()): string {
  const delta = diffDays(iso, today)
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  if (delta === -1) return 'Yesterday'
  if (delta > 1 && delta < 7) return WEEKDAY.format(fromISODate(iso))
  return MONTH_DAY.format(fromISODate(iso))
}

export function formatLongDay(iso: string, today = todayISO()): string {
  const delta = diffDays(iso, today)
  const base = LONG_DAY.format(fromISODate(iso))
  if (delta === 0) return `Today · ${base}`
  if (delta === 1) return `Tomorrow · ${base}`
  if (delta === -1) return `Yesterday · ${base}`
  return base
}

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
