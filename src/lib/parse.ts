import { addDays, addMonths, isoDow, todayISO, toISODate } from './dates'
import type { Priority, Recurrence } from './types'

/**
 * Natural-language quick-add, e.g.
 *   "Pay rent every month on the 1st @home p1 #bills"
 *   "Gym tomorrow at 6pm #health"   "Standup every weekday 9:30am @work"
 * Returns the cleaned title plus the recognised pieces and their character spans,
 * so the input can show a live, colour-coded preview.
 */
export type TokenKind = 'date' | 'time' | 'repeat' | 'priority' | 'tag' | 'project'

export interface Token {
  kind: TokenKind
  start: number
  end: number
  text: string
}

export interface ParsedQuest {
  title: string
  due_date: string | null
  due_time: string | null
  priority: Priority | null
  recurrence: Recurrence | null
  recur_interval: number
  tags: string[]
  project: string | null
  tokens: Token[]
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_RE = '(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)'
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const B = '(?<=^|\\s)' // token must start at a word boundary made of whitespace
const E = '(?=$|[\\s,.;!?])'

function dayIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3)
  return DAYS.findIndex((d) => d.startsWith(w)) + 1 // ISO 1..7
}

/** Next date (today included) that falls on ISO weekday `dow`. */
function upcomingDow(today: string, dow: number, skipToday = false): string {
  let delta = (dow - isoDow(today) + 7) % 7
  if (delta === 0 && skipToday) delta = 7
  return addDays(today, delta)
}

function monthDay(today: string, month: number, day: number): string | null {
  const year = Number(today.slice(0, 4))
  const make = (y: number) => {
    const d = new Date(y, month, day)
    return d.getMonth() === month ? toISODate(d) : null
  }
  const thisYear = make(year)
  if (!thisYear) return null
  return thisYear >= today ? thisYear : make(year + 1)
}

function ordinalDay(today: string, day: number): string | null {
  if (day < 1 || day > 31) return null
  const [y, m] = today.split('-').map(Number)
  for (let i = 0; i < 13; i++) {
    const d = new Date(y, m - 1 + i, day)
    if (d.getDate() === day) {
      const iso = toISODate(d)
      if (iso >= today) return iso
    }
  }
  return null
}

function to24(h: number, min: number, ampm?: string): string | null {
  let hh = h
  if (ampm) {
    if (h < 1 || h > 12) return null
    const pm = ampm.toLowerCase().startsWith('p')
    hh = (h % 12) + (pm ? 12 : 0)
  }
  if (hh > 23 || min > 59) return null
  return `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

interface Rule {
  kind: TokenKind
  re: RegExp
  apply: (m: RegExpExecArray, out: ParsedQuest, today: string) => boolean
}

const RULES: Rule[] = [
  // ---- repeat
  {
    kind: 'repeat',
    re: new RegExp(`${B}every\\s+(\\d{1,3})\\s+(day|week|month|year)s?${E}`, 'i'),
    apply: (m, out) => {
      const unit = m[1] && m[2].toLowerCase()
      out.recurrence = ({ day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' } as const)[unit as 'day']
      out.recur_interval = Math.min(365, Math.max(1, Number(m[1])))
      return true
    },
  },
  {
    kind: 'repeat',
    re: new RegExp(`${B}(?:every\\s+(?:week\\s*day|weekday)s?|weekdays)${E}`, 'i'),
    apply: (_m, out) => ((out.recurrence = 'weekdays'), true),
  },
  {
    kind: 'repeat',
    re: new RegExp(`${B}every\\s+${DAY_RE}${E}`, 'i'),
    apply: (m, out, today) => {
      out.recurrence = 'weekly'
      out.due_date ??= upcomingDow(today, dayIndex(m[1]))
      return true
    },
  },
  {
    kind: 'repeat',
    re: new RegExp(`${B}(?:every\\s+(day|night|morning|week|month|year)|(daily|nightly|weekly|monthly|yearly|annually))${E}`, 'i'),
    apply: (m, out) => {
      const w = (m[1] ?? m[2]).toLowerCase()
      out.recurrence = w.startsWith('d') || w.startsWith('n') || w.startsWith('mor')
        ? 'daily'
        : w.startsWith('w')
          ? 'weekly'
          : w.startsWith('mon')
            ? 'monthly'
            : 'yearly'
      return true
    },
  },
  // ---- dates
  {
    kind: 'date',
    re: new RegExp(`${B}(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)${E}`, 'i'),
    apply: (m, out, today) => {
      const d = ordinalDay(today, Number(m[1]))
      if (!d) return false
      out.due_date = d
      return true
    },
  },
  {
    kind: 'date',
    re: new RegExp(`${B}(?:(?:on|by|due)\\s+)?(today|tod|tonight|tomorrow|tmrw?|tmr|yesterday)${E}`, 'i'),
    apply: (m, out, today) => {
      const w = m[1].toLowerCase()
      out.due_date = w.startsWith('to') && w !== 'tomorrow' ? today : w === 'yesterday' ? addDays(today, -1) : addDays(today, 1)
      if (w === 'tonight') out.due_time ??= '20:00'
      return true
    },
  },
  {
    kind: 'date',
    re: new RegExp(`${B}(?:(?:on|by|due)\\s+)?(?:(this|next)\\s+)?${DAY_RE}${E}`, 'i'),
    apply: (m, out, today) => {
      // "fri" / "this fri" = the coming Friday (today if it is Friday); "next fri" skips today.
      out.due_date = upcomingDow(today, dayIndex(m[2]), m[1]?.toLowerCase() === 'next')
      return true
    },
  },
  {
    kind: 'date',
    re: new RegExp(`${B}(?:(this|next)\\s+)?(week|weekend|month)${E}`, 'i'),
    apply: (m, out, today) => {
      const which = m[1]?.toLowerCase()
      const what = m[2].toLowerCase()
      if (!which && what !== 'weekend') return false
      if (what === 'weekend') out.due_date = upcomingDow(today, 6, which === 'next')
      else if (what === 'week') out.due_date = which === 'next' ? upcomingDow(today, 1, true) : upcomingDow(today, 5)
      else {
        const [y, mo] = today.split('-').map(Number)
        out.due_date = which === 'next' ? toISODate(new Date(y, mo, 1)) : toISODate(new Date(y, mo, 0))
      }
      return true
    },
  },
  {
    kind: 'date',
    re: new RegExp(`${B}in\\s+(\\d{1,3}|a|an|one|two|three)\\s+(day|week|month)s?${E}`, 'i'),
    apply: (m, out, today) => {
      const words: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3 }
      const n = words[m[1].toLowerCase()] ?? Number(m[1])
      const unit = m[2].toLowerCase()
      out.due_date = unit === 'day' ? addDays(today, n) : unit === 'week' ? addDays(today, 7 * n) : addMonths(today, n)
      return true
    },
  },
  {
    kind: 'date',
    re: new RegExp(`${B}(?:(?:on|by|due)\\s+)?(?:${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?|(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE})${E}`, 'i'),
    apply: (m, out, today) => {
      const monthWord = (m[1] ?? m[4]).toLowerCase().slice(0, 3)
      const day = Number(m[2] ?? m[3])
      const d = monthDay(today, MONTHS.indexOf(monthWord), day)
      if (!d) return false
      out.due_date = d
      return true
    },
  },
  {
    kind: 'date',
    re: new RegExp(`${B}(?:(?:on|by|due)\\s+)?(\\d{4})-(\\d{2})-(\\d{2})${E}`),
    apply: (m, out) => {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      if (d.getMonth() !== Number(m[2]) - 1) return false
      out.due_date = toISODate(d)
      return true
    },
  },
  {
    kind: 'date',
    re: new RegExp(`${B}(?:(?:on|by|due)\\s+)?(\\d{1,2})/(\\d{1,2})${E}`),
    apply: (m, out, today) => {
      const d = monthDay(today, Number(m[1]) - 1, Number(m[2]))
      if (!d) return false
      out.due_date = d
      return true
    },
  },
  // ---- time
  {
    kind: 'time',
    re: new RegExp(`${B}(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s?(am|pm)${E}`, 'i'),
    apply: (m, out) => {
      const t = to24(Number(m[1]), Number(m[2] ?? 0), m[3])
      if (!t) return false
      out.due_time = t
      return true
    },
  },
  {
    kind: 'time',
    re: new RegExp(`${B}(?:at\\s+)?([01]?\\d|2[0-3]):([0-5]\\d)${E}`, 'i'),
    apply: (m, out) => ((out.due_time = to24(Number(m[1]), Number(m[2]))), out.due_time !== null),
  },
  {
    kind: 'time',
    re: new RegExp(`${B}(?:at\\s+)?(noon|midday|midnight)${E}`, 'i'),
    apply: (m, out) => ((out.due_time = m[1].toLowerCase() === 'midnight' ? '00:00' : '12:00'), true),
  },
  // ---- priority (P1 = urgent ... P4 = low, plus !!! / !! shorthands)
  {
    kind: 'priority',
    re: new RegExp(`${B}(?:p([1-4])|!(urgent|high|normal|low)|(!{1,3}))${E}`, 'i'),
    apply: (m, out) => {
      if (m[1]) out.priority = (5 - Number(m[1])) as Priority
      else if (m[2]) out.priority = ({ urgent: 4, high: 3, normal: 2, low: 1 } as const)[m[2].toLowerCase() as 'low']
      else out.priority = (m[3].length + 1) as Priority
      return true
    },
  },
  // ---- project (@name) and tags (#tag, repeatable)
  {
    kind: 'project',
    re: new RegExp(`${B}@([\\p{L}\\p{N}][\\p{L}\\p{N}_-]{0,39})${E}`, 'iu'),
    apply: (m, out) => ((out.project = m[1]), true),
  },
]

const TAG_RE = new RegExp(`${B}#([a-z0-9][a-z0-9_-]{0,23})${E}`, 'gi')

export function parseQuickAdd(input: string, today = todayISO()): ParsedQuest {
  const out: ParsedQuest = {
    title: '',
    due_date: null,
    due_time: null,
    priority: null,
    recurrence: null,
    recur_interval: 1,
    tags: [],
    project: null,
    tokens: [],
  }
  const taken: boolean[] = new Array(input.length).fill(false)
  const free = (s: number, e: number) => taken.slice(s, e).every((t) => !t)
  const claim = (kind: TokenKind, s: number, e: number) => {
    for (let i = s; i < e; i++) taken[i] = true
    out.tokens.push({ kind, start: s, end: e, text: input.slice(s, e) })
  }
  const done = new Set<TokenKind>()

  for (const rule of RULES) {
    if (done.has(rule.kind)) continue
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(input))) {
      const s = m.index
      const e = s + m[0].length
      if (!free(s, e)) continue
      if (rule.apply(m, out, today)) {
        claim(rule.kind, s, e)
        done.add(rule.kind)
        break
      }
    }
  }
  let m: RegExpExecArray | null
  TAG_RE.lastIndex = 0
  while ((m = TAG_RE.exec(input))) {
    const s = m.index
    const e = s + m[0].length
    if (!free(s, e) || out.tags.length >= 8) continue
    const tag = m[1].toLowerCase()
    if (!out.tags.includes(tag)) out.tags.push(tag)
    claim('tag', s, e)
  }

  // A repeat or a time with no date starts today (an "every <day>" rule already set its date).
  if (!out.due_date && (out.recurrence || out.due_time)) out.due_date = today

  out.tokens.sort((a, b) => a.start - b.start)
  out.title = input
    .split('')
    .map((ch, i) => (taken[i] ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/^[\s,.;-]+|[\s,;-]+$/g, '')
    .trim()
  return out
}
