import type { SupabaseClient } from '@supabase/supabase-js'
import { localTimeZone } from './dates'
import { complete, computeStats, emptyState, newTask, seedDemo, uncomplete, type GameState } from './engine'
import { VIEWS } from './supabase'
import type { Achievement, Profile, Project, Stats, Task, TaskInput, TaskPatch } from './types'

export interface Snapshot {
  tasks: Task[]
  projects: Project[]
  profile: Profile
  achievements: Achievement[]
  stats: Stats
}

export type ChangeKind = 'tasks' | 'achievements' | 'profile'

export interface Backend {
  mode: 'cloud' | 'local'
  load(): Promise<Snapshot>
  stats(): Promise<Stats>
  tasks(): Promise<Task[]>
  achievements(): Promise<Achievement[]>
  profile(): Promise<Profile>
  createTask(input: TaskInput): Promise<Task>
  updateTask(id: string, patch: TaskPatch): Promise<Task>
  setStatus(id: string, status: 'open' | 'done'): Promise<Task>
  deleteTask(id: string): Promise<void>
  createProject(name: string, color: string): Promise<Project>
  updateProfile(patch: Partial<Profile>): Promise<Profile>
  startDemo(): Promise<void>
  subscribe(onChange: (kind: ChangeKind) => void): () => void
}

const TASK_COLS = 'id,title,notes,priority,due_date,due_time,recurrence,recur_interval,project_id,tags,status,completed_at,xp_awarded,on_time,spawned_from,created_at,updated_at'
const PROFILE_COLS = 'display_name,avatar,skin,accent,time_zone'

const normTime = (t: string | null) => (t ? t.slice(0, 5) : null)
const normTask = (t: Task): Task => ({ ...t, due_time: normTime(t.due_time), tags: t.tags ?? [] })

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

export function cloudBackend(sb: SupabaseClient, userId: string, defaultName: string): Backend {
  const tasks = async () => {
    // Every open quest, plus the most recent 400 completed ones for the quest log.
    const [open, done] = await Promise.all([
      sb.from(VIEWS.tasks).select(TASK_COLS).eq('status', 'open').order('created_at').limit(2000),
      sb.from(VIEWS.tasks).select(TASK_COLS).eq('status', 'done').order('completed_at', { ascending: false }).limit(400),
    ])
    fail(open.error)
    fail(done.error)
    return [...(open.data as Task[]), ...(done.data as Task[])].map(normTask)
  }
  const stats = async () => {
    const { data, error } = await sb.rpc('xplan_stats', { days: 182 })
    fail(error)
    return data as Stats
  }
  const achievements = async () => {
    const { data, error } = await sb.from(VIEWS.achievements).select('code,unlocked_at').order('unlocked_at')
    fail(error)
    return data as Achievement[]
  }
  return {
    mode: 'cloud',
    tasks,
    stats,
    achievements,
    async profile() {
      const { data, error } = await sb.from(VIEWS.profiles).select(PROFILE_COLS).eq('user_id', userId).single()
      fail(error)
      return data as Profile
    },
    async load() {
      const boot = await sb.rpc('xplan_bootstrap', { tz: localTimeZone(), name: defaultName })
      fail(boot.error)
      const profile = (boot.data as Profile[])[0]
      const [t, p, a, s] = await Promise.all([
        tasks(),
        sb.from(VIEWS.projects).select('id,name,color,created_at').order('created_at'),
        achievements(),
        stats(),
      ])
      fail(p.error)
      return { tasks: t, projects: p.data as Project[], profile, achievements: a, stats: s }
    },
    async createTask(input) {
      const { data, error } = await sb.from(VIEWS.tasks).insert(input).select(TASK_COLS).single()
      fail(error)
      return normTask(data as Task)
    },
    async updateTask(id, patch) {
      const { data, error } = await sb.from(VIEWS.tasks).update(patch).eq('id', id).select(TASK_COLS).single()
      fail(error)
      return normTask(data as Task)
    },
    async setStatus(id, status) {
      const { data, error } = await sb.from(VIEWS.tasks).update({ status }).eq('id', id).select(TASK_COLS).single()
      fail(error)
      return normTask(data as Task)
    },
    async deleteTask(id) {
      const { error } = await sb.from(VIEWS.tasks).delete().eq('id', id)
      fail(error)
    },
    async createProject(name, color) {
      const { data, error } = await sb.from(VIEWS.projects).insert({ name, color }).select('id,name,color,created_at').single()
      fail(error)
      return data as Project
    },
    async updateProfile(patch) {
      const { data, error } = await sb.from(VIEWS.profiles).update(patch).eq('user_id', userId).select(PROFILE_COLS).single()
      fail(error)
      return data as Profile
    },
    async startDemo() {
      const { error } = await sb.rpc('xplan_start_demo', { tz: localTimeZone() })
      fail(error)
    },
    subscribe(onChange) {
      const channel = sb
        .channel(`xplan-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'xplan', table: 'tasks', filter: `user_id=eq.${userId}` }, () => onChange('tasks'))
        .on('postgres_changes', { event: 'INSERT', schema: 'xplan', table: 'achievements', filter: `user_id=eq.${userId}` }, () => onChange('achievements'))
        .on('postgres_changes', { event: 'UPDATE', schema: 'xplan', table: 'profiles', filter: `user_id=eq.${userId}` }, () => onChange('profile'))
        .subscribe()
      return () => void sb.removeChannel(channel)
    },
  }
}

// ------------------------------------------------------------------ local mode
const LOCAL_KEY = 'xplan:save'
const PROFILE_KEY = 'xplan:profile'
const DEFAULT_PROFILE: Profile = { display_name: 'Player', avatar: 'sword', skin: 'forge', accent: null, time_zone: localTimeZone() }

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** Runs the same rules in the browser (src/lib/engine.ts); syncs between tabs via `storage` events. */
export function localBackend(): Backend {
  let state: GameState = readJSON(LOCAL_KEY, emptyState())
  const save = () => localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
  const profile = (): Profile => ({ ...DEFAULT_PROFILE, ...readJSON<Partial<Profile>>(PROFILE_KEY, {}) })
  const find = (id: string) => {
    const t = state.tasks.find((x) => x.id === id)
    if (!t) throw new Error('Quest not found')
    return t
  }
  const later = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 0))
  return {
    mode: 'local',
    tasks: () => later(state.tasks),
    stats: () => later(computeStats(state)),
    achievements: () => later(state.achievements),
    profile: () => later(profile()),
    async load() {
      state = readJSON(LOCAL_KEY, emptyState())
      return later({ tasks: state.tasks, projects: state.projects, profile: profile(), achievements: state.achievements, stats: computeStats(state) })
    },
    async createTask(input) {
      const t = newTask({ ...input, recurrence: input.due_date ? (input.recurrence ?? null) : null })
      state = { ...state, tasks: [...state.tasks, t] }
      save()
      return later(t)
    },
    async updateTask(id, patch) {
      const t = { ...find(id), ...patch, updated_at: new Date().toISOString() }
      if (patch.tags) t.tags = [...new Set(patch.tags.map((x) => x.toLowerCase()))].sort()
      if (!t.due_date) t.recurrence = null
      state = { ...state, tasks: state.tasks.map((x) => (x.id === id ? t : x)) }
      save()
      return later(t)
    },
    async setStatus(id, status) {
      state = status === 'done' ? complete(state, id) : uncomplete(state, id)
      save()
      return later(find(id))
    },
    async deleteTask(id) {
      state = { ...state, tasks: state.tasks.filter((x) => x.id !== id) }
      save()
    },
    async createProject(name, color) {
      const existing = state.projects.find((p) => p.name.toLowerCase() === name.toLowerCase())
      if (existing) return existing
      const p: Project = { id: crypto.randomUUID(), name, color, created_at: new Date().toISOString() }
      state = { ...state, projects: [...state.projects, p] }
      save()
      return later(p)
    },
    async updateProfile(patch) {
      const next = { ...profile(), ...patch }
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
      return later(next)
    },
    async startDemo() {
      if (state.tasks.length) return
      state = seedDemo()
      save()
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile(), display_name: 'Guest Player' }))
    },
    subscribe(onChange) {
      const handler = (e: StorageEvent) => {
        if (e.key === LOCAL_KEY) {
          state = readJSON(LOCAL_KEY, emptyState())
          onChange('tasks')
          onChange('achievements')
        } else if (e.key === PROFILE_KEY) onChange('profile')
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}
