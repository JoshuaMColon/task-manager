import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './parse'

const TODAY = '2026-10-30' // a Friday
const p = (s: string) => parseQuickAdd(s, TODAY)

describe('parseQuickAdd', () => {
  it('leaves plain titles alone', () => {
    expect(p('Buy milk')).toMatchObject({ title: 'Buy milk', due_date: null, due_time: null, priority: null, recurrence: null, tags: [], project: null })
  })
  it('parses relative dates and times', () => {
    expect(p('Gym tomorrow at 6pm')).toMatchObject({ title: 'Gym', due_date: '2026-10-31', due_time: '18:00' })
    expect(p('Call mom friday')).toMatchObject({ title: 'Call mom', due_date: '2026-10-30' })
    expect(p('Call mom next friday')).toMatchObject({ due_date: '2026-11-06' })
    expect(p('Dentist monday 9:30am')).toMatchObject({ title: 'Dentist', due_date: '2026-11-02', due_time: '09:30' })
    expect(p('Report in 3 days')).toMatchObject({ title: 'Report', due_date: '2026-11-02' })
    expect(p('Taxes apr 15')).toMatchObject({ title: 'Taxes', due_date: '2027-04-15' })
    expect(p('Launch 2026-12-01')).toMatchObject({ title: 'Launch', due_date: '2026-12-01' })
    expect(p('Movie tonight')).toMatchObject({ title: 'Movie', due_date: TODAY, due_time: '20:00' })
    expect(p('Lunch noon')).toMatchObject({ title: 'Lunch', due_date: TODAY, due_time: '12:00' })
  })
  it('does not treat counts as times', () => {
    expect(p('Read 2 a day')).toMatchObject({ due_time: null })
    expect(p('Buy 2 apples')).toMatchObject({ title: 'Buy 2 apples', due_time: null })
  })
  it('parses repeats', () => {
    expect(p('Pay rent every month on the 1st p1')).toMatchObject({ title: 'Pay rent', recurrence: 'monthly', due_date: '2026-11-01', priority: 4 })
    expect(p('Standup every weekday 9:30am')).toMatchObject({ title: 'Standup', recurrence: 'weekdays', due_time: '09:30', due_date: TODAY })
    expect(p('Water plants every 3 days')).toMatchObject({ title: 'Water plants', recurrence: 'daily', recur_interval: 3 })
    expect(p('Team sync every tuesday')).toMatchObject({ title: 'Team sync', recurrence: 'weekly', due_date: '2026-11-03' })
    expect(p('Read 20 pages daily')).toMatchObject({ title: 'Read 20 pages', recurrence: 'daily', due_date: TODAY })
  })
  it('parses priority, tags and project', () => {
    expect(p('Fix prod bug !urgent #bug #backend @work')).toMatchObject({ title: 'Fix prod bug', priority: 4, tags: ['bug', 'backend'], project: 'work' })
    expect(p('Tidy desk p4')).toMatchObject({ title: 'Tidy desk', priority: 1 })
    expect(p('Ship it !!!')).toMatchObject({ title: 'Ship it', priority: 4 })
  })
  it('reports token ranges for highlighting', () => {
    const r = p('Gym tomorrow #legs')
    const kinds = r.tokens.map((t) => [t.kind, 'Gym tomorrow #legs'.slice(t.start, t.end).trim()])
    expect(kinds).toEqual(expect.arrayContaining([['date', 'tomorrow'], ['tag', '#legs']]))
  })
  it('treats markup as plain text (no HTML is ever interpreted)', () => {
    expect(p('<img src=x onerror=alert(1)>').title).toBe('<img src=x onerror=alert(1)>')
  })
})
