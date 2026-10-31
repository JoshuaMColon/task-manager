import { useRef, useState, type PointerEvent as RPE } from 'react'
import { AlarmClock, Check, CornerDownRight, Folder, Repeat } from 'lucide-react'
import { formatDue, formatTime } from '../lib/dates'
import type { Project, Task } from '../lib/types'
import { PRIORITY_COLOR, PRIORITY_META, recurrenceLabel, xpFor } from '../lib/xp'


interface Props {
  task: Task
  project?: Project
  today: string
  selected: boolean
  showDate?: boolean
  onComplete(task: Task, at: { x: number; y: number }): void
  onReopen(task: Task): void
  onOpen(task: Task): void
  onSnooze(task: Task): void
  onSelect(task: Task): void
}

const THRESHOLD = 84

export function QuestItem({ task, project, today, selected, showDate = true, onComplete, onReopen, onOpen, onSnooze, onSelect }: Props) {
  const done = task.status === 'done'
  const overdue = !done && !!task.due_date && task.due_date < today
  const meta = PRIORITY_META[task.priority]
  const reward = done ? task.xp_awarded : xpFor(task.priority, !!task.due_date && task.due_date >= today)
  const [dx, setDx] = useState(0)
  const [checking, setChecking] = useState(false)
  const start = useRef<{ x: number; y: number; id: number; locked: boolean | null } | null>(null)

  const complete = (x: number, y: number) => {
    setChecking(true)
    setTimeout(() => setChecking(false), 320)
    onComplete(task, { x, y })
  }

  // Touch / pen swipe: right = complete, left = snooze to tomorrow.
  const down = (e: RPE) => {
    if (e.pointerType === 'mouse' || done) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, locked: null }
  }
  const move = (e: RPE) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const ddx = e.clientX - s.x
    const ddy = e.clientY - s.y
    if (s.locked === null && Math.hypot(ddx, ddy) > 8) {
      s.locked = Math.abs(ddx) > Math.abs(ddy) * 1.3
      if (s.locked) {
        try {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        } catch {
          /* pointer already released */
        }
      }
    }
    if (s.locked) setDx(Math.max(-140, Math.min(140, ddx)))
  }
  const up = (e: RPE) => {
    const s = start.current
    start.current = null
    if (!s?.locked) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (dx > THRESHOLD) complete(rect.left + 40, rect.top + rect.height / 2)
    else if (dx < -THRESHOLD) onSnooze(task)
    setDx(0)
  }

  const swipeHint = dx > 24 ? 'complete' : dx < -24 ? 'snooze' : null

  return (
    <li className="relative" data-quest-id={task.id}>
      {swipeHint && (
        <div aria-hidden="true" className={`absolute inset-0 flex items-center rounded-skin px-5 text-sm font-bold ${swipeHint === 'complete' ? 'justify-start bg-success/20 text-success' : 'justify-end bg-accent/20 text-accent-ink'}`}>
          {swipeHint === 'complete' ? (
            <span className="flex items-center gap-2"><Check className="size-4" /> Complete</span>
          ) : (
            <span className="flex items-center gap-2">Tomorrow <AlarmClock className="size-4" /></span>
          )}
        </div>
      )}
      <div
        data-swipe
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          start.current = null
          setDx(0)
        }}
        onClick={() => onSelect(task)}
        onDoubleClick={() => onOpen(task)}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: 'pan-y' }}
        className={`group relative flex items-start gap-3 rounded-skin border bg-surface px-3 py-3 transition-[border-color,background-color,box-shadow] sm:px-4 ${selected ? 'border-accent shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_22%,transparent)]' : 'border-line hover:border-line-strong'} ${dx ? '' : 'transition-transform'}`}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Reopen quest: ${task.title}` : `Complete quest: ${task.title}`}
          data-tip={done ? 'Reopen quest' : 'Complete quest'}
          onClick={(e) => {
            e.stopPropagation()
            if (done) onReopen(task)
            else complete(e.clientX || e.currentTarget.getBoundingClientRect().left + 12, e.clientY || e.currentTarget.getBoundingClientRect().top)
          }}
          className={`hex mt-0.5 grid size-7 shrink-0 place-items-center transition-colors ${checking ? 'anim-check' : ''}`}
          style={{ background: done ? 'var(--success)' : PRIORITY_COLOR[task.priority] }}
        >
          <span className={`hex grid size-[22px] place-items-center ${done ? 'bg-success text-surface' : 'bg-surface text-transparent group-hover:text-muted'}`}>
            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(task) }} className={`block w-full truncate text-left text-[15px] font-semibold leading-6 ${done ? 'text-muted line-through decoration-2' : ''}`}>
            {task.title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            {task.priority >= 3 && !done && (
              <span className="chip display font-bold" style={{ color: PRIORITY_COLOR[task.priority] }}>
                {meta.short} · {meta.rarity}
              </span>
            )}
            {showDate && task.due_date && (
              <span className={`chip ${overdue ? 'bg-danger/12 text-danger' : ''}`}>
                <AlarmClock className="size-3" aria-hidden="true" />
                {formatDue(task.due_date, today)}
                {task.due_time ? ` · ${formatTime(task.due_time)}` : ''}
              </span>
            )}
            {!showDate && task.due_time && <span className="chip"><AlarmClock className="size-3" aria-hidden="true" />{formatTime(task.due_time)}</span>}
            {task.recurrence && (
              <span className="chip">
                <Repeat className="size-3" aria-hidden="true" />
                {recurrenceLabel(task.recurrence, task.recur_interval)}
              </span>
            )}
            {project && (
              <span className="chip">
                <Folder className="size-3" style={{ color: project.color }} aria-hidden="true" />
                {project.name}
              </span>
            )}
            {task.tags.map((t) => (
              <span key={t} className="chip">#{t}</span>
            ))}
            {task.notes && <CornerDownRight className="size-3.5 text-muted" aria-label="Has notes" />}
          </div>
        </div>
        <span className={`display mt-1 shrink-0 text-xs font-extrabold ${done ? 'text-success' : 'text-accent-ink'}`} aria-label={done ? `${reward} XP earned` : `Reward ${reward} XP`}>
          {done ? (reward ? `+${reward}` : '0') : `${reward}`} XP
        </span>
      </div>
    </li>
  )
}
