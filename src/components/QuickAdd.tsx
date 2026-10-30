import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AlarmClock, CalendarDays, Folder, Hash, Plus, Repeat, Swords } from 'lucide-react'
import { formatDue, formatTime } from '../lib/dates'
import { parseQuickAdd, type ParsedQuest, type TokenKind } from '../lib/parse'
import type { Project } from '../lib/types'
import { PRIORITY_META, recurrenceLabel, xpFor } from '../lib/xp'

export interface QuickAddHandle {
  focus(): void
}

interface Props {
  today: string
  projects: Project[]
  /** Defaults applied when the text doesn't say otherwise (e.g. Today view = due today). */
  defaults?: { due_date?: string | null; project_id?: string | null }
  onAdd(q: ParsedQuest & { project_id: string | null }): void
  compact?: boolean
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  date: 'bg-accent/25',
  time: 'bg-accent/25',
  repeat: 'bg-[color-mix(in_oklab,var(--p3)_28%,transparent)]',
  priority: 'bg-[color-mix(in_oklab,var(--p1)_28%,transparent)]',
  tag: 'bg-[color-mix(in_oklab,var(--p2)_28%,transparent)]',
  project: 'bg-[color-mix(in_oklab,var(--success)_28%,transparent)]',
}

const EXAMPLES = ['Pay rent every month on the 1st p1', 'Gym tomorrow 6pm @health #legs', 'Standup every weekday 9:30am @work', 'Call mom friday !high', 'Read 20 pages daily #habit']

export const QuickAdd = forwardRef<QuickAddHandle, Props>(function QuickAdd({ today, projects, defaults, onAdd, compact }, ref) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const mirror = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), [])
  const parsed = useMemo(() => parseQuickAdd(text, today), [text, today])
  const placeholder = useMemo(() => `Add a quest — try “${EXAMPLES[Math.floor(Date.now() / 86_400_000) % EXAMPLES.length]}”`, [])

  const due = parsed.due_date ?? (defaults?.due_date && !parsed.tokens.some((t) => t.kind === 'date') ? defaults.due_date : null)
  const project = parsed.project ? projects.find((p) => p.name.toLowerCase() === parsed.project!.toLowerCase()) : projects.find((p) => p.id === defaults?.project_id)
  const projectName = parsed.project ? (project?.name ?? parsed.project) : project?.name
  const reward = xpFor(parsed.priority ?? 2, !!due)

  const submit = () => {
    if (!parsed.title) return
    onAdd({ ...parsed, due_date: due, recurrence: due ? parsed.recurrence : null, project: projectName ?? null, project_id: project?.id ?? null })
    setText('')
  }

  // Highlighted copy of the input text, rendered behind the transparent input.
  const segments = useMemo(() => {
    const out: { text: string; kind?: TokenKind }[] = []
    let i = 0
    for (const t of [...parsed.tokens].sort((a, b) => a.start - b.start)) {
      if (t.start < i) continue
      if (t.start > i) out.push({ text: text.slice(i, t.start) })
      out.push({ text: text.slice(t.start, t.end), kind: t.kind })
      i = t.end
    }
    if (i < text.length) out.push({ text: text.slice(i) })
    return out
  }, [parsed.tokens, text])

  const chips: { icon: typeof Plus; label: string; key: string }[] = []
  if (due) chips.push({ key: 'due', icon: CalendarDays, label: formatDue(due, today) })
  if (parsed.due_time) chips.push({ key: 'time', icon: AlarmClock, label: formatTime(parsed.due_time) })
  if (parsed.recurrence && due) chips.push({ key: 'rep', icon: Repeat, label: recurrenceLabel(parsed.recurrence, parsed.recur_interval) })
  if (parsed.priority !== null) chips.push({ key: 'pri', icon: Swords, label: `${PRIORITY_META[parsed.priority].short} · ${PRIORITY_META[parsed.priority].rarity}` })
  if (projectName) chips.push({ key: 'proj', icon: Folder, label: project ? projectName : `${projectName} (new)` })
  for (const t of parsed.tags) chips.push({ key: `t-${t}`, icon: Hash, label: t })

  return (
    <form
      className="card p-2"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="flex items-center gap-2">
        <span className="hex grid size-9 shrink-0 place-items-center bg-accent text-on-accent" aria-hidden="true">
          <Plus className="size-4" strokeWidth={3} />
        </span>
        <div className="relative min-w-0 flex-1">
          <div ref={mirror} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-1 py-2 text-[15px] leading-6 text-transparent">
            {segments.map((s, i) => (
              <mark key={i} className={`rounded-[4px] text-transparent ${s.kind ? TOKEN_CLASS[s.kind] : 'bg-transparent'}`}>
                {s.text}
              </mark>
            ))}
          </div>
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onScroll={(e) => mirror.current && (mirror.current.scrollLeft = e.currentTarget.scrollLeft)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setText('')
                e.currentTarget.blur()
              }
            }}
            placeholder={placeholder}
            aria-label="Quick add quest"
            aria-describedby="quickadd-preview"
            maxLength={300}
            enterKeyHint="done"
            autoComplete="off"
            data-quickadd
            className="relative w-full bg-transparent px-1 py-2 text-[15px] leading-6 placeholder:text-muted focus:outline-none"
          />
        </div>
        <button type="submit" className="btn btn-primary shrink-0 px-3 sm:px-4" disabled={!parsed.title}>
          <span className={compact ? 'sr-only' : 'hidden sm:inline'}>Add quest</span>
          <span className={compact ? '' : 'sm:hidden'} aria-hidden="true">Add</span>
        </button>
      </div>
      <div id="quickadd-preview" data-testid="quickadd-preview" aria-live="polite" className={`overflow-hidden px-1 transition-all ${text ? 'max-h-40 pt-2' : 'max-h-0'}`}>
        {text && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2 text-xs">
            <span className="mr-1 min-w-0 max-w-full truncate font-bold">{parsed.title || <span className="text-muted">Quest name…</span>}</span>
            {chips.map((c) => (
              <span key={c.key} className="chip text-ink">
                <c.icon className="size-3" aria-hidden="true" />
                {c.label}
              </span>
            ))}
            <span className="display ml-auto font-extrabold text-accent-ink">+{reward} XP</span>
          </div>
        )}
      </div>
    </form>
  )
})
