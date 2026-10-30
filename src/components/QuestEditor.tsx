import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Priority, Project, Recurrence, Task, TaskPatch } from '../lib/types'
import { PRIORITY_COLOR, PRIORITY_META, xpFor } from '../lib/xp'
import { Modal } from './Modal'

interface Props {
  task: Task | null
  projects: Project[]
  onClose(): void
  onSave(id: string, patch: TaskPatch): void
  onDelete(task: Task): void
  onCreateProject(name: string): Promise<Project | undefined>
}

export function QuestEditor(props: Props) {
  return (
    <Modal open={!!props.task} onClose={props.onClose} title="Edit quest">
      {props.task && <EditorForm key={props.task.id} {...props} task={props.task} />}
    </Modal>
  )
}

function EditorForm({ task, projects, onClose, onSave, onDelete, onCreateProject }: Props & { task: Task }) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [due, setDue] = useState(task.due_date ?? '')
  const [time, setTime] = useState(task.due_time ?? '')
  const [rec, setRec] = useState<Recurrence | ''>(task.recurrence ?? '')
  const [step, setStep] = useState(task.recur_interval)
  const [project, setProject] = useState(task.project_id ?? '')
  const [tags, setTags] = useState(task.tags.join(', '))
  const [newProject, setNewProject] = useState('')

  const save = async () => {
    let project_id = project || null
    if (project === '__new' && newProject.trim()) project_id = (await onCreateProject(newProject.trim()))?.id ?? null
    onSave(task.id, {
      title: title.trim() || task.title,
      notes,
      priority,
      due_date: due || null,
      due_time: due && time ? time : null,
      recurrence: due && rec ? rec : null,
      recur_interval: Math.max(1, Math.min(365, step || 1)),
      project_id: project_id === '__new' ? null : project_id,
      tags: tags.split(/[\s,]+/).map((t) => t.replace(/^#/, '').toLowerCase()).filter((t) => /^[a-z0-9][a-z0-9_-]{0,23}$/.test(t)).slice(0, 8),
    })
    onClose()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-bold text-muted">Quest</span>
        <input className="field text-base font-semibold" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required data-autofocus />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-bold text-muted">Notes</span>
        <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      </label>
      <fieldset>
        <legend className="mb-1 text-xs font-bold text-muted">Priority</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {([4, 3, 2, 1] as Priority[]).map((p) => (
            <label key={p} className={`cursor-pointer rounded-skin-sm border px-2 py-2 text-center text-xs font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${priority === p ? 'border-accent bg-accent/12' : 'border-line hover:border-line-strong'}`}>
              <input type="radio" name="priority" className="sr-only" checked={priority === p} onChange={() => setPriority(p)} />
              <span className="display block text-sm" style={{ color: PRIORITY_COLOR[p] }}>{PRIORITY_META[p].short}</span>
              <span className="text-muted">{PRIORITY_META[p].rarity}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-muted">Due date</span>
          <input type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-muted">Time</span>
          <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} disabled={!due} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-muted">Repeat</span>
          <select className="field" value={rec} onChange={(e) => setRec(e.target.value as Recurrence | '')} disabled={!due}>
            <option value="">Doesn’t repeat</option>
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-muted">Every</span>
          <input type="number" min={1} max={365} className="field" value={step} onChange={(e) => setStep(Number(e.target.value))} disabled={!due || !rec || rec === 'weekdays'} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-muted">Project</span>
          <select className="field" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="__new">+ New project…</option>
          </select>
        </label>
        {project === '__new' ? (
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-muted">Project name</span>
            <input className="field" value={newProject} onChange={(e) => setNewProject(e.target.value)} maxLength={40} />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-muted">Tags</span>
            <input className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="habit, errand" />
          </label>
        )}
      </div>
      <p className="text-xs text-muted">
        Reward: <span className="display font-extrabold text-accent-ink">{xpFor(priority, false)} XP</span>, or <span className="display font-extrabold text-accent-ink">{xpFor(priority, true)} XP</span> when finished on time.
      </p>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
        <button type="button" className="btn text-danger hover:bg-danger/10" onClick={() => { onDelete(task); onClose() }}>
          <Trash2 className="size-4" aria-hidden="true" /> Delete
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </div>
    </form>
  )
}
