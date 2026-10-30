import { useMemo, useState, type ReactNode } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import type { Project, Task } from '../lib/types'
import { matches } from '../lib/views'
import { Modal } from './Modal'

export interface Command {
  id: string
  label: string
  group: string
  icon?: ReactNode
  hint?: string
  keywords?: string
  run(): void
}

interface Props {
  open: boolean
  onClose(): void
  commands: Command[]
  tasks: Task[]
  projects: Project[]
  onOpenTask(t: Task): void
  onAddText(text: string): void
}

export function CommandPalette(props: Props) {
  return (
    <Modal open={props.open} onClose={props.onClose} title="Command palette" top wide>
      <PaletteBody {...props} />
    </Modal>
  )
}

function PaletteBody({ onClose, commands, tasks, projects, onOpenTask, onAddText }: Props) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const items = useMemo(() => {
    const s = q.trim().toLowerCase()
    const words = s.split(/\s+/).filter(Boolean)
    const cmds = commands.filter((c) => {
      const hay = `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
    const pName = new Map(projects.map((p) => [p.id, p.name]))
    const quests: Command[] = s
      ? tasks
          .filter((t) => matches(t, s, t.project_id ? pName.get(t.project_id) : undefined))
          .slice(0, 8)
          .map((t) => ({ id: `t-${t.id}`, group: t.status === 'done' ? 'Completed quests' : 'Quests', label: t.title, run: () => onOpenTask(t) }))
      : []
    const add: Command[] = s ? [{ id: 'add', group: 'Create', label: `Add quest “${q.trim()}”`, run: () => onAddText(q.trim()) }] : []
    return [...cmds, ...quests, ...add]
  }, [q, commands, tasks, projects, onOpenTask, onAddText])
  const sel = Math.min(active, Math.max(0, items.length - 1))
  const choose = (c: Command | undefined) => {
    if (!c) return
    onClose()
    c.run()
  }
  let lastGroup = ''
  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          data-autofocus
          className="field pl-9 text-base"
          placeholder="Search quests, jump to a view, change skin…"
          value={q}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={items[sel] ? `cmd-${items[sel].id}` : undefined}
          aria-label="Command"
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(items.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(items[sel])
            }
          }}
        />
      </div>
      <ul id="palette-list" role="listbox" aria-label="Results" className="mt-3 max-h-[50dvh] overflow-y-auto">
        {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No matches</li>}
        {items.map((c, i) => {
          const header = c.group !== lastGroup ? c.group : null
          lastGroup = c.group
          return (
            <li key={c.id} role="presentation">
              {header && <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted">{header}</p>}
              <div
                id={`cmd-${c.id}`}
                role="option"
                aria-selected={i === sel}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(c)}
                className={`flex cursor-pointer items-center gap-3 rounded-skin-sm px-3 py-2 text-sm ${i === sel ? 'bg-accent/15 text-ink' : ''}`}
              >
                <span className="text-muted">{c.icon}</span>
                <span className="flex-1 truncate font-semibold">{c.label}</span>
                {c.hint && <span className="kbd">{c.hint}</span>}
                {i === sel && <CornerDownLeft className="size-3.5 text-muted" aria-hidden="true" />}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
