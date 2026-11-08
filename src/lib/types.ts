export type Priority = 1 | 2 | 3 | 4
export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'
export type Status = 'open' | 'done'
export type SkinId = 'forge' | 'alloy' | 'bloom' | 'slate'

// A quest. priority runs 4 (P1 urgent) down to 1 (P4 low) so a numeric sort
// puts the rarest first, and it matches the smallint on xplan.tasks.
// xp_awarded, on_time, completed_at and spawned_from are not client fields:
// guard_task overwrites them on any write that comes from the app.
export interface Task {
  id: string
  user_id?: string
  title: string
  notes: string
  /** 4 = P1 urgent ... 1 = P4 low (matches xplan.tasks.priority). */
  priority: Priority
  due_date: string | null
  due_time: string | null
  recurrence: Recurrence | null
  recur_interval: number
  project_id: string | null
  tags: string[]
  status: Status
  completed_at: string | null
  xp_awarded: number
  on_time: boolean | null
  spawned_from: string | null
  created_at: string
  updated_at: string
}

// Create and edit shapes on purpose omit status, xp and spawned_from.
// Completion goes through setStatus so the status trigger is the only path
// that awards XP. A general update cannot re-parent a quest or mark it done.
export type TaskInput = Pick<Task, 'title'> &
  Partial<Pick<Task, 'notes' | 'priority' | 'due_date' | 'due_time' | 'recurrence' | 'recur_interval' | 'project_id' | 'tags'>>
export type TaskPatch = Partial<Pick<Task, 'title' | 'notes' | 'priority' | 'due_date' | 'due_time' | 'recurrence' | 'recur_interval' | 'project_id' | 'tags'>>

export interface Project {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Profile {
  display_name: string
  avatar: string
  skin: SkinId
  accent: string | null
  time_zone: string
}

export interface Achievement {
  code: string
  unlocked_at: string
}

export interface Stats {
  total_xp: number
  level: number
  level_floor: number
  level_next: number
  current_streak: number
  best_streak: number
  done: number
  open: number
  overdue: number
  done_today: number
  clear_rate: number | null
  on_time_pct: number | null
  xp_today: number
  today: string
  heatmap: { d: string; n: number }[]
}
