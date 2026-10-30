import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, CalendarDays, Flame, Gamepad2, Inbox, Keyboard, Loader2, Palette, Plus, RotateCcw, ScrollText, Siren, Sparkles, Trophy } from 'lucide-react'
import { AuthScreen } from './components/AuthScreen'
import { CommandPalette, type Command } from './components/CommandPalette'
import { Customize } from './components/Customize'
import { FeedbackProvider, useFeedback } from './components/Feedback'
import { Heatmap } from './components/Heatmap'
import { MobileNav, Sidebar } from './components/Nav'
import { nameFromEmail } from './lib/names'
import { NAV } from './lib/nav'
import { PlayerCard } from './components/PlayerCard'
import { QuestEditor } from './components/QuestEditor'
import { QuestItem } from './components/QuestItem'
import { QuickAdd, type QuickAddHandle } from './components/QuickAdd'
import { ShortcutsHelp } from './components/ShortcutsHelp'
import { Trophies } from './components/Trophies'
import { useAuth } from './hooks/useAuth'
import { useGame } from './hooks/useGame'
import { navigate, PATH_OF, useRoute } from './hooks/useRoute'
import { ACHIEVEMENT_BY_CODE } from './lib/achievements'
import { cloudBackend, localBackend, type Backend, type Snapshot } from './lib/backend'
import { addDays, todayISO } from './lib/dates'
import { parseQuickAdd, type ParsedQuest } from './lib/parse'
import { applySkin, pairedSkin, SKIN_BY_ID, SKINS } from './lib/skins'
import { supabase } from './lib/supabase'
import type { Priority, Task } from './lib/types'
import { groupsFor, isOverdue, isToday, type Group, type ViewId } from './lib/views'

export default function App() {
  return (
    <FeedbackProvider>
      <Shell />
    </FeedbackProvider>
  )
}

function Shell() {
  const auth = useAuth()
  const [route] = useRoute()
  const [demo] = useState(route.demo)
  // Which /demo visit we already started a guest sign-in for. Reset whenever we leave /demo, so a
  // second "Play as guest" in the same tab (e.g. after signing out) starts a fresh guest again.
  const guestStarted = useRef(false)
  const [guestError, setGuestError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // /demo signs in a fresh anonymous guest (cloud) or seeds the local save file.
  useEffect(() => {
    if (!route.demo) {
      guestStarted.current = false
      return
    }
    if (!auth.enabled || !auth.ready || guestStarted.current) return
    if (auth.session?.user.is_anonymous) return
    guestStarted.current = true
    const go = async () => {
      if (auth.session) await auth.signOut()
      await withTimeout(auth.guest(), GUEST_TIMEOUT_MS, 'The guest sign-in timed out.')
    }
    // Shown only while we're still on /demo without a session; leaving /demo clears it.
    go().catch((e) => setGuestError(e instanceof Error ? e.message : 'Guest sign-in failed.'))
  }, [route.demo, auth, attempt])

  const retryGuest = () => {
    guestStarted.current = false
    setGuestError(null)
    setAttempt((n) => n + 1)
  }
  const leaveDemo = () => {
    setGuestError(null)
    navigate('/')
  }

  const userId = auth.session?.user.id
  const backend = useMemo<Backend | null>(() => {
    if (!supabase) return localBackend()
    if (!userId) return null
    return cloudBackend(supabase, userId, nameFromEmail(auth.session?.user.email))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (route.demo && auth.enabled && !auth.session && guestError)
    return <LoadError title="Couldn’t start the guest demo" message={guestError} onRetry={retryGuest} onBack={leaveDemo} />
  if (!auth.ready || (route.demo && auth.enabled && !auth.session)) return route.demo ? <Splash onRetry={retryGuest} onBack={leaveDemo} /> : <Splash />
  if (!backend)
    return <AuthScreen onSignIn={auth.signIn} onSignUp={auth.signUp} onGuest={() => { setGuestError(null); navigate('/demo') }} />
  return <Game key={userId ?? 'local'} backend={backend} demo={demo || route.demo} guest={!!auth.session?.user.is_anonymous} onSignOut={auth.enabled ? () => void auth.signOut().then(() => navigate('/')) : undefined} />
}

const GUEST_TIMEOUT_MS = 15_000
const SPLASH_STALL_MS = 15_000

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

/** Loading screen. If it lasts too long it offers Retry instead of spinning forever. */
function Splash({ text = 'Loading your save file…', onRetry, onBack }: { text?: string; onRetry?: () => void; onBack?: () => void }) {
  const [stalled, setStalled] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setStalled(true), SPLASH_STALL_MS)
    return () => clearTimeout(t)
  }, [])
  if (stalled)
    return <LoadError title="This is taking longer than it should" message="Your save file didn’t load. Check your connection and try again." onRetry={onRetry ?? (() => window.location.reload())} onBack={onBack} />
  return (
    <main className="grid min-h-dvh place-items-center" aria-busy="true">
      <div className="flex items-center gap-3 text-muted" role="status">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {text}
      </div>
    </main>
  )
}

function LoadError({ title, message, onRetry, onBack }: { title: string; message: string; onRetry(): void; onBack?: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="card max-w-sm p-6 text-center" role="alert">
        <h1 className="display text-lg font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            <RotateCcw className="size-4" aria-hidden="true" /> Retry
          </button>
          {onBack && (
            <button type="button" className="btn btn-ghost" onClick={onBack}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

const TITLES: Record<ViewId, { title: string; icon: typeof Inbox; blurb: string }> = {
  hq: { title: 'HQ', icon: Gamepad2, blurb: 'Your player dashboard' },
  today: { title: 'Daily missions', icon: CalendarDays, blurb: 'Clear today’s quests to keep your combo alive' },
  upcoming: { title: 'Upcoming', icon: CalendarClock, blurb: 'The next 7 days and beyond' },
  inbox: { title: 'Inbox', icon: Inbox, blurb: 'Quests without a due date' },
  overdue: { title: 'Overdue', icon: Siren, blurb: 'Late quests still earn XP, just without the on-time bonus' },
  log: { title: 'Quest log', icon: ScrollText, blurb: 'Everything you’ve cleared' },
  trophies: { title: 'Trophies', icon: Trophy, blurb: 'Achievements and activity' },
  project: { title: 'Project', icon: Inbox, blurb: '' },
}

function Game({ backend, demo, guest, onSignOut }: { backend: Backend; demo: boolean; guest: boolean; onSignOut?: () => void }) {
  const fb = useFeedback()
  const [route, go] = useRoute()
  const { snap, error, actions } = useGame(backend, demo, {
    onLevelUp: (l) => fb.levelUp(l),
    onAchievement: (c) => fb.trophy(c),
    onError: (m) => fb.toast({ kind: 'error', title: 'Sync problem', body: m }),
  })

  useEffect(() => {
    if (snap && route.demo) navigate('/', true)
  }, [snap, route.demo])

  useEffect(() => {
    if (snap) applySkin(snap.profile.skin, snap.profile.accent)
  }, [snap?.profile.skin, snap?.profile.accent]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <LoadError title="Couldn’t load your save file" message={error} onRetry={() => window.location.reload()} />
  if (!snap) return <Splash />
  return <GameUI snap={snap} actions={actions} view={route.view} projectId={route.projectId} go={go} mode={backend.mode} guest={guest} onSignOut={onSignOut} />
}

type Actions = ReturnType<typeof useGame>['actions']

function GameUI({ snap, actions, view, projectId, go, mode, guest, onSignOut }: { snap: Snapshot; actions: Actions; view: ViewId; projectId?: string; go(p: string): void; mode: 'cloud' | 'local'; guest: boolean; onSignOut?: () => void }) {
  const fb = useFeedback()
  const today = todayISO()
  const { tasks, projects, profile, stats, achievements } = snap
  const quick = useRef<QuickAddHandle>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<Task | null>(null)
  const [palette, setPalette] = useState(false)
  const [help, setHelp] = useState(false)
  const [custom, setCustom] = useState(false)

  const project = view === 'project' ? projects.find((p) => p.id === projectId) : undefined
  const groups = useMemo(() => groupsFor(view, tasks, today, projectId), [view, tasks, today, projectId])
  const flat = useMemo(() => groups.flatMap((g) => g.tasks), [groups])
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const counts = useMemo(() => {
    const open = tasks.filter((t) => t.status === 'open')
    return {
      today: open.filter((t) => isToday(t, today) || isOverdue(t, today)).length,
      inbox: open.filter((t) => !t.due_date).length,
      overdue: open.filter((t) => isOverdue(t, today)).length,
    }
  }, [tasks, today])
  const projectCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tasks) if (t.status === 'open' && t.project_id) m.set(t.project_id, (m.get(t.project_id) ?? 0) + 1)
    return m
  }, [tasks])

  const complete = useCallback(
    (t: Task, at?: { x: number; y: number }) => {
      const gained = actions.complete(t)
      const el = document.querySelector(`[data-quest-id="${t.id}"]`)?.getBoundingClientRect()
      const p = at ?? (el ? { x: el.left + 30, y: el.top + el.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 })
      fb.pop(p.x, p.y, gained ? `+${gained} XP` : 'Daily XP cap')
      fb.buzz(14)
    },
    [actions, fb],
  )
  const reopen = useCallback(
    (t: Task) => {
      actions.reopen(t)
      fb.toast({ kind: 'info', title: 'Quest reopened', body: t.xp_awarded ? `−${t.xp_awarded} XP` : undefined }, 2500)
    },
    [actions, fb],
  )
  const snooze = useCallback(
    (t: Task) => {
      const base = t.due_date && t.due_date > today ? t.due_date : today
      actions.update(t.id, { due_date: addDays(base, 1) })
      fb.toast({ kind: 'info', title: 'Snoozed', body: `“${t.title}” moved to ${base === today ? 'tomorrow' : 'the next day'}` }, 2500)
      fb.buzz(8)
    },
    [actions, fb, today],
  )
  const remove = useCallback(
    (t: Task) => {
      const undo = actions.remove(t)
      fb.toast({ kind: 'info', title: 'Quest deleted', body: t.title, action: { label: 'Undo', run: undo } }, 5000)
    },
    [actions, fb],
  )
  const add = useCallback(
    (q: ParsedQuest & { project_id: string | null }) => {
      void actions.create({ title: q.title, due_date: q.due_date, due_time: q.due_time, priority: q.priority ?? 2, recurrence: q.recurrence, recur_interval: q.recur_interval, tags: q.tags, project_id: q.project_id, projectName: q.project_id ? null : q.project })
      fb.buzz(6)
    },
    [actions, fb],
  )

  // Keyboard shortcuts
  const gPending = useRef(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((o) => !o)
        return
      }
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (el.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return
      const sel = flat.find((t) => t.id === selected)
      if (gPending.current) {
        gPending.current = false
        const n = NAV.find((x) => x.key.toLowerCase() === e.key.toLowerCase())
        if (n) {
          e.preventDefault()
          go(PATH_OF[n.view])
        }
        return
      }
      const move = (d: number) => {
        e.preventDefault()
        if (!flat.length) return
        const i = flat.findIndex((t) => t.id === selected)
        const next = flat[Math.max(0, Math.min(flat.length - 1, i < 0 ? 0 : i + d))]
        setSelected(next.id)
        document.querySelector(`[data-quest-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' })
      }
      switch (e.key) {
        case 'g':
          gPending.current = true
          setTimeout(() => (gPending.current = false), 1200)
          break
        case 'n':
        case 'q':
          e.preventDefault()
          quick.current?.focus()
          break
        case '/':
          e.preventDefault()
          setPalette(true)
          break
        case '?':
          e.preventDefault()
          setHelp(true)
          break
        case 'j':
        case 'ArrowDown':
          move(1)
          break
        case 'k':
        case 'ArrowUp':
          move(-1)
          break
        case 'x':
          if (sel) {
            e.preventDefault()
            if (sel.status === 'done') reopen(sel)
            else complete(sel)
          }
          break
        case 'e':
        case 'Enter':
          if (sel) {
            e.preventDefault()
            setEditing(sel)
          }
          break
        case 's':
          if (sel && sel.status === 'open') snooze(sel)
          break
        case 'Delete':
        case 'Backspace':
          if (sel) {
            e.preventDefault()
            remove(sel)
          }
          break
        case '1':
        case '2':
        case '3':
        case '4':
          if (sel) actions.update(sel.id, { priority: (5 - Number(e.key)) as Priority })
          break
        case 'Escape':
          setSelected(null)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flat, selected, go, complete, reopen, snooze, remove, actions])

  const twin = pairedSkin(profile.skin)
  const modeToggle = useMemo(() => {
    if (!twin) return undefined
    const dark = SKIN_BY_ID[profile.skin].dark
    return { dark, label: `Switch to ${dark ? 'light' : 'dark'} mode (${SKIN_BY_ID[twin].name})`, run: () => actions.updateProfile({ skin: twin }) }
  }, [twin, profile.skin, actions])
  const commands = useMemo<Command[]>(() => {
    const nav = NAV.map((n) => ({ id: `go-${n.view}`, group: 'Go to', label: n.label, icon: <n.icon className="size-4" />, hint: `G ${n.key}`, run: () => go(PATH_OF[n.view]) }))
    const proj = projects.map((p) => ({ id: `p-${p.id}`, group: 'Projects', label: p.name, keywords: 'project', run: () => go(`/project/${p.id}`) }))
    const skins = SKINS.map((s) => ({ id: `skin-${s.id}`, group: 'Skins', label: `Skin: ${s.name}`, keywords: `theme ${s.tagline}`, icon: <Palette className="size-4" />, run: () => actions.updateProfile({ skin: s.id }) }))
    return [
      { id: 'new', group: 'Actions', label: 'New quest', icon: <Plus className="size-4" />, hint: 'N', run: () => setTimeout(() => quick.current?.focus(), 50) },
      { id: 'custom', group: 'Actions', label: 'Customize player', icon: <Palette className="size-4" />, keywords: 'avatar accent name', run: () => setCustom(true) },
      { id: 'help', group: 'Actions', label: 'Keyboard shortcuts', icon: <Keyboard className="size-4" />, hint: '?', run: () => setHelp(true) },
      ...nav,
      ...proj,
      ...skins,
      ...(modeToggle ? [{ id: 'mode', group: 'Skins', label: modeToggle.label, keywords: 'theme light dark mode toggle', icon: <Palette className="size-4" />, run: modeToggle.run }] : []),
    ]
  }, [projects, go, actions, modeToggle])

  const meta = TITLES[view]
  const Icon = meta.icon
  const quickDefaults = view === 'today' ? { due_date: today } : view === 'project' ? { project_id: projectId ?? null } : undefined
  const list = (gs: Group[], opts?: { showDate?: (g: Group) => boolean }) =>
    gs.map((g) => (
      <section key={g.key} aria-labelledby={`g-${g.key}`} className="mb-6">
        <h3 id={`g-${g.key}`} className={`display mb-2 flex items-center gap-2 text-xs font-extrabold ${g.tone === 'danger' ? 'text-danger' : 'text-muted'}`}>
          {g.label} <span className="font-bold opacity-70">{g.tasks.length}</span>
          {g.key === 'overdue' && view !== 'overdue' && (
            <button type="button" className="ml-auto text-xs font-bold text-accent-ink hover:underline" onClick={() => g.tasks.forEach((t) => actions.update(t.id, { due_date: today }))}>
              Move all to today
            </button>
          )}
        </h3>
        <ul className="space-y-2">
          {g.tasks.map((t) => (
            <QuestItem key={t.id} task={t} project={t.project_id ? projectById.get(t.project_id) : undefined} today={today} selected={selected === t.id} showDate={opts?.showDate ? opts.showDate(g) : true} onComplete={complete} onReopen={reopen} onOpen={setEditing} onSnooze={snooze} onSelect={(x) => setSelected(x.id)} />
          ))}
        </ul>
      </section>
    ))

  const todayGroups = groupsFor('hq', tasks, today)
  const missionTotal = stats.done_today + counts.today
  const empty = (
    <div className="card grid place-items-center gap-2 px-6 py-12 text-center">
      <Sparkles className="size-8 text-accent-ink" aria-hidden="true" />
      <p className="display text-lg font-extrabold">{view === 'today' || view === 'hq' ? 'All missions cleared' : view === 'overdue' ? 'Nothing overdue' : view === 'log' ? 'No quests cleared yet' : 'No quests here'}</p>
      <p className="max-w-sm text-sm text-muted">{view === 'log' ? 'Complete a quest to start your log.' : 'Add one above — try “Gym tomorrow 6pm p2 #health”.'}</p>
    </div>
  )

  let body: React.ReactNode
  if (view === 'hq') {
    const nextUp = tasks.filter((t) => t.status === 'open' && t.due_date && t.due_date > today).sort((a, b) => a.due_date!.localeCompare(b.due_date!)).slice(0, 4)
    const recent = [...achievements].sort((a, b) => b.unlocked_at.localeCompare(a.unlocked_at)).slice(0, 4)
    body = (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <PlayerCard profile={profile} stats={stats} onCustomize={() => setCustom(true)} />
          <QuickAdd ref={quick} today={today} projects={projects} onAdd={add} defaults={{ due_date: today }} />
          <section aria-labelledby="missions-h">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="missions-h" className="display text-lg font-extrabold">Daily missions</h2>
                <p className="text-xs text-muted">{counts.today ? `${stats.done_today}/${missionTotal} cleared · finish them all for a perfect day` : 'Perfect day! Every mission cleared.'}</p>
              </div>
              <MissionRing done={stats.done_today} total={missionTotal} />
            </div>
            {todayGroups.length ? list(todayGroups) : empty}
          </section>
        </div>
        <aside className="space-y-6" aria-label="Side panel">
          <section className="card p-4" aria-labelledby="next-h">
            <h2 id="next-h" className="display mb-3 flex items-center gap-2 text-sm font-extrabold"><CalendarClock className="size-4 text-accent-ink" aria-hidden="true" /> Next up</h2>
            {nextUp.length ? (
              <ul className="space-y-2">
                {nextUp.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => setEditing(t)} className="flex w-full items-center gap-2 rounded-skin-sm px-2 py-1.5 text-left text-sm hover:bg-surface-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: `var(--p${5 - t.priority})` }} aria-hidden="true" />
                      <span className="flex-1 truncate font-semibold">{t.title}</span>
                      <span className="text-xs text-muted">{new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' }).format(new Date(`${t.due_date}T12:00`))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Nothing scheduled.</p>}
          </section>
          <section className="card p-4" aria-labelledby="streak-h">
            <h2 id="streak-h" className="display mb-3 flex items-center gap-2 text-sm font-extrabold"><Flame className="size-4 text-accent-ink" aria-hidden="true" /> Activity</h2>
            <Heatmap stats={stats} weeks={17} />
          </section>
          <section className="card p-4" aria-labelledby="recent-h">
            <h2 id="recent-h" className="display mb-3 flex items-center gap-2 text-sm font-extrabold"><Trophy className="size-4 text-gold" aria-hidden="true" /> Recent trophies</h2>
            {recent.length ? (
              <ul className="grid grid-cols-2 gap-2">
                {recent.map((a) => {
                  const m = ACHIEVEMENT_BY_CODE.get(a.code)
                  if (!m) return null
                  return (
                    <li key={a.code} className="flex items-center gap-2 rounded-skin-sm bg-surface-2 p-2">
                      <span className="hex grid size-8 shrink-0 place-items-center bg-gold text-surface"><m.icon className="size-3.5" aria-hidden="true" /></span>
                      <span className="truncate text-xs font-bold">{m.name}</span>
                    </li>
                  )
                })}
              </ul>
            ) : <p className="text-sm text-muted">Clear your first quest to earn one.</p>}
            <a href="/trophies" onClick={(e) => { e.preventDefault(); go('/trophies') }} className="mt-3 block text-xs font-bold text-accent-ink hover:underline">All trophies →</a>
          </section>
        </aside>
      </div>
    )
  } else if (view === 'trophies') {
    body = <Trophies achievements={achievements} stats={stats} />
  } else {
    body = (
      <div className="max-w-3xl">
        {view !== 'log' && (
          <div className="mb-6">
            <QuickAdd ref={quick} today={today} projects={projects} onAdd={add} defaults={quickDefaults} />
          </div>
        )}
        {view === 'overdue' && flat.length > 0 && (
          <button type="button" className="btn btn-ghost mb-4" onClick={() => flat.forEach((t) => actions.update(t.id, { due_date: today }))}>
            <CalendarDays className="size-4" aria-hidden="true" /> Move all to today
          </button>
        )}
        {groups.length ? list(groups, { showDate: (g) => view === 'today' ? g.key === 'overdue' : view !== 'upcoming' || g.key === 'later' }) : empty}
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded bg-accent px-3 py-2 text-on-accent focus:not-sr-only focus:fixed focus:left-2 focus:top-2">Skip to content</a>
      <Sidebar view={view} projectId={projectId} counts={counts} projects={projects} projectCounts={projectCounts} profile={profile} stats={stats} mode={mode} guest={guest} go={go} onPalette={() => setPalette(true)} onCustomize={() => setCustom(true)} onHelp={() => setHelp(true)} onSignOut={onSignOut} modeToggle={modeToggle} />
      <div className="min-w-0 flex-1">
        <MobileNav view={view} projectId={projectId} counts={counts} projects={projects} projectCounts={projectCounts} profile={profile} stats={stats} mode={mode} guest={guest} go={go} onPalette={() => setPalette(true)} onCustomize={() => setCustom(true)} onHelp={() => setHelp(true)} onSignOut={onSignOut} modeToggle={modeToggle} />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 md:pb-10 md:pt-8 lg:px-10">
          <header className="mb-6 flex items-center gap-3">
            <span className="hex hidden size-10 place-items-center bg-surface-2 text-accent-ink sm:grid" aria-hidden="true">
              <Icon className="size-5" style={project ? { color: project.color } : undefined} />
            </span>
            <div className="min-w-0">
              <h1 className="display truncate text-2xl font-extrabold sm:text-3xl">{project?.name ?? meta.title}</h1>
              <p className="text-sm text-muted">{project ? `${projectCounts.get(project.id) ?? 0} open quests` : meta.blurb}</p>
            </div>
          </header>
          {body}
        </main>
      </div>
      {view !== 'hq' && view !== 'log' && view !== 'trophies' ? null : (
        <button type="button" onClick={() => (view === 'hq' ? quick.current?.focus() : go('/today'))} className="hex fixed bottom-20 right-4 z-20 grid size-14 place-items-center bg-accent text-on-accent shadow-lg md:hidden" aria-label="New quest">
          <Plus className="size-6" strokeWidth={3} />
        </button>
      )}
      <QuestEditor task={editing} projects={projects} onClose={() => setEditing(null)} onSave={(id, p) => actions.update(id, p)} onDelete={remove} onCreateProject={actions.createProject} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} commands={commands} tasks={tasks} projects={projects} onOpenTask={setEditing} onAddText={(text) => {
        const q = parseQuickAdd(text, today)
        if (q.title) add({ ...q, project_id: q.project ? (projects.find((p) => p.name.toLowerCase() === q.project!.toLowerCase())?.id ?? null) : null })
      }} />
      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
      <Customize open={custom} profile={profile} onClose={() => setCustom(false)} onChange={actions.updateProfile} />
    </div>
  )
}

function MissionRing({ done, total }: { done: number; total: number }) {
  const pct = total ? done / total : 1
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 44 44" className="size-12 shrink-0" role="img" aria-label={`${done} of ${total} daily missions cleared`}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--bar-track)" strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 22 22)" style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      <text x="22" y="26" textAnchor="middle" className="display" fontSize="11" fontWeight="800" fill="var(--text)">{done}/{total}</text>
    </svg>
  )
}
