import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Backend, Snapshot } from '../lib/backend'
import { toISODate, todayISO } from '../lib/dates'
import type { Profile, Project, Task, TaskInput, TaskPatch } from '../lib/types'
import { DAILY_XP_CAP, levelFor, levelThreshold, xpFor } from '../lib/xp'

export interface GameEvents {
  onLevelUp(level: number): void
  onAchievement(code: string): void
  onError(message: string): void
}

const PROJECT_COLORS = ['#f97316', '#22c55e', '#a855f7', '#0ea5e9', '#e11d48', '#eab308', '#14b8a6', '#6366f1']

/**
 * The game state: one snapshot (quests, projects, profile, trophies, stats) kept in sync with the
 * backend. Every mutation is applied optimistically, then reconciled with the server, which is the
 * source of truth for XP, levels, streaks and trophies (see supabase/migrations).
 */
export function useGame(backend: Backend | null, demo: boolean, events: GameEvents) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ev = useRef(events)
  const inFlight = useRef(0)
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const levelRef = useRef<number | null>(null)
  const seen = useRef<Set<string> | null>(null)
  const demoRef = useRef(demo)
  useLayoutEffect(() => {
    ev.current = events
    demoRef.current = demo
  })

  // Fire level-up / trophy events whenever the numbers move (optimistic or confirmed).
  useEffect(() => {
    if (!snap) return
    const lvl = snap.stats.level
    if (levelRef.current !== null && lvl > levelRef.current) ev.current.onLevelUp(lvl)
    levelRef.current = lvl
    const codes = new Set(snap.achievements.map((a) => a.code))
    if (seen.current) for (const c of codes) if (!seen.current.has(c)) ev.current.onAchievement(c)
    seen.current = codes
  }, [snap])

  const fail = useCallback((e: unknown) => {
    ev.current.onError(e instanceof Error ? e.message : 'Something went wrong')
  }, [])

  const refresh = useCallback(async () => {
    if (!backend || inFlight.current > 0) return
    try {
      const [tasks, stats, achievements] = await Promise.all([backend.tasks(), backend.stats(), backend.achievements()])
      if (inFlight.current > 0) return
      setSnap((s) => (s ? { ...s, tasks: tasks.filter((t) => !pendingDeletes.current.has(t.id)), stats, achievements } : s))
    } catch (e) {
      fail(e)
    }
  }, [backend, fail])

  // Initial load (+ demo seeding) and realtime/cross-tab sync.
  useEffect(() => {
    if (!backend) return
    let alive = true
    levelRef.current = null
    seen.current = null
    ;(async () => {
      try {
        if (demoRef.current) await backend.startDemo().catch(() => undefined)
        const s = await backend.load()
        if (alive) setSnap(s)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load your save file')
      }
    })()
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = backend.subscribe((kind) => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        if (kind === 'profile') {
          const profile = await backend.profile().catch(() => null)
          if (profile && alive) setSnap((s) => (s ? { ...s, profile } : s))
        } else void refresh()
      }, 350)
    })
    const flush = () => {
      for (const [id, t] of pendingDeletes.current) {
        clearTimeout(t)
        void backend.deleteTask(id)
      }
      pendingDeletes.current.clear()
    }
    window.addEventListener('pagehide', flush)
    return () => {
      alive = false
      clearTimeout(timer)
      unsubscribe()
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [backend, refresh])

  const run = useCallback(
    async <T,>(optimistic: (s: Snapshot) => Snapshot, call: () => Promise<T>): Promise<T | undefined> => {
      setSnap((s) => (s ? optimistic(s) : s))
      inFlight.current++
      try {
        return await call()
      } catch (e) {
        fail(e)
        return undefined
      } finally {
        inFlight.current--
        void refresh()
      }
    },
    [fail, refresh],
  )

  const actions = useMemo(() => {
    const patchTask = (s: Snapshot, id: string, fn: (t: Task) => Task): Snapshot => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)) })
    const withXp = (s: Snapshot, delta: number, done: number, today: number): Snapshot => {
      const total = Math.max(0, s.stats.total_xp + delta)
      const level = levelFor(total)
      return { ...s, stats: { ...s.stats, total_xp: total, level, level_floor: levelThreshold(level), level_next: levelThreshold(level + 1), done: s.stats.done + done, open: s.stats.open - done, done_today: s.stats.done_today + today, xp_today: s.stats.xp_today + delta } }
    }
    return {
      /** Completes a quest; returns the XP it is expected to award (for the pop-up). */
      complete(task: Task): number {
        if (!backend || !snap) return 0
        const today = todayISO()
        const onTime = !!task.due_date && today <= task.due_date
        const rewarded = snap.tasks.filter((t) => t.status === 'done' && t.xp_awarded > 0 && t.completed_at && toISODate(new Date(t.completed_at)) === today).length
        const gained = rewarded >= DAILY_XP_CAP ? 0 : xpFor(task.priority, onTime)
        void run(
          (s) => withXp(patchTask(s, task.id, (t) => ({ ...t, status: 'done', completed_at: new Date().toISOString(), xp_awarded: gained, on_time: task.due_date ? onTime : null })), gained, 1, 1),
          () => backend.setStatus(task.id, 'done'),
        )
        return gained
      },
      reopen(task: Task) {
        if (!backend) return
        const wasToday = !!task.completed_at && toISODate(new Date(task.completed_at)) === todayISO()
        void run(
          (s) => withXp(patchTask(s, task.id, (t) => ({ ...t, status: 'open', completed_at: null, xp_awarded: 0, on_time: null })), -task.xp_awarded, -1, wasToday ? -1 : 0),
          () => backend.setStatus(task.id, 'open'),
        )
      },
      async create(input: TaskInput & { projectName?: string | null }) {
        if (!backend || !snap) return
        let project_id = input.project_id ?? null
        if (input.projectName) {
          const existing = snap.projects.find((p) => p.name.toLowerCase() === input.projectName!.toLowerCase())
          if (existing) project_id = existing.id
          else {
            try {
              const p = await backend.createProject(input.projectName, PROJECT_COLORS[snap.projects.length % PROJECT_COLORS.length])
              setSnap((s) => (s ? { ...s, projects: [...s.projects, p] } : s))
              project_id = p.id
            } catch (e) {
              fail(e)
            }
          }
        }
        const { projectName: _ignored, ...rest } = input
        void _ignored
        const now = new Date().toISOString()
        const temp: Task = { id: `tmp-${Date.now()}`, notes: '', priority: 2, due_date: null, due_time: null, recurrence: null, recur_interval: 1, tags: [], status: 'open', completed_at: null, xp_awarded: 0, on_time: null, spawned_from: null, created_at: now, updated_at: now, ...rest, project_id }
        await run(
          (s) => ({ ...s, tasks: [...s.tasks, temp], stats: { ...s.stats, open: s.stats.open + 1 } }),
          async () => {
            const t = await backend.createTask({ ...rest, project_id })
            setSnap((s) => (s ? { ...s, tasks: s.tasks.map((x) => (x.id === temp.id ? t : x)) } : s))
            return t
          },
        )
      },
      update(id: string, patch: TaskPatch) {
        if (!backend) return
        void run((s) => patchTask(s, id, (t) => ({ ...t, ...patch, recurrence: (patch.due_date === null ? null : (patch.recurrence ?? t.recurrence)) ?? null })), () => backend.updateTask(id, patch))
      },
      /** Removes a quest after a 5s grace period; returns an undo function. */
      remove(task: Task): () => void {
        if (!backend) return () => undefined
        setSnap((s) => (s ? { ...s, tasks: s.tasks.filter((t) => t.id !== task.id) } : s))
        const timer = setTimeout(() => {
          pendingDeletes.current.delete(task.id)
          backend.deleteTask(task.id).catch(fail).finally(() => void refresh())
        }, 5000)
        pendingDeletes.current.set(task.id, timer)
        return () => {
          clearTimeout(timer)
          pendingDeletes.current.delete(task.id)
          setSnap((s) => (s && !s.tasks.some((t) => t.id === task.id) ? { ...s, tasks: [...s.tasks, task] } : s))
        }
      },
      async createProject(name: string): Promise<Project | undefined> {
        if (!backend || !snap) return
        try {
          const p = await backend.createProject(name, PROJECT_COLORS[snap.projects.length % PROJECT_COLORS.length])
          setSnap((s) => (s ? { ...s, projects: [...s.projects.filter((x) => x.id !== p.id), p] } : s))
          return p
        } catch (e) {
          fail(e)
        }
      },
      updateProfile(patch: Partial<Profile>) {
        if (!backend) return
        setSnap((s) => (s ? { ...s, profile: { ...s.profile, ...patch } } : s))
        backend.updateProfile(patch).catch(fail)
      },
    }
  }, [backend, snap, run, fail, refresh])

  return { snap, error, actions, refresh }
}
