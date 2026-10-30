import { Folder, Keyboard, LogOut, Menu, Palette, Search } from 'lucide-react'
import { NAV } from '../lib/nav'
import { useState } from 'react'
import { PATH_OF } from '../hooks/useRoute'
import type { Profile, Project, Stats } from '../lib/types'
import type { ViewId } from '../lib/views'
import { Avatar } from './Avatar'
import { XpBar } from './PlayerCard'
import { Modal } from './Modal'


interface NavProps {
  view: ViewId
  projectId?: string
  counts: Partial<Record<ViewId, number>>
  projects: Project[]
  projectCounts: Map<string, number>
  profile: Profile
  stats: Stats
  mode: 'cloud' | 'local'
  guest: boolean
  go(path: string): void
  onPalette(): void
  onCustomize(): void
  onHelp(): void
  onSignOut?(): void
}

function NavLink({ active, href, go, children, badge, danger }: { active: boolean; href: string; go(p: string): void; children: React.ReactNode; badge?: number; danger?: boolean }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        go(href)
      }}
      className={`group relative flex items-center gap-3 rounded-skin-sm px-3 py-2 text-sm font-semibold transition-colors ${active ? 'bg-accent/14 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-accent" aria-hidden="true" />}
      {children}
      {!!badge && <span className={`ml-auto rounded-full px-1.5 text-[11px] font-bold leading-5 ${danger ? 'bg-danger text-surface' : 'bg-surface-2 text-muted'}`}>{badge}</span>}
    </a>
  )
}

export function Sidebar(p: NavProps) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-panel px-3 py-4 backdrop-blur md:flex">
      <a href="/" onClick={(e) => { e.preventDefault(); p.go('/') }} className="mb-5 flex items-center gap-2 px-2" aria-label="XPlan home">
        <img src="/favicon.svg" alt="" className="size-7" />
        <span className="display text-xl font-extrabold">XPlan</span>
        {p.guest && <span className="chip ml-auto">Guest</span>}
        {p.mode === 'local' && <span className="chip ml-auto" title="Saved in this browser">Local</span>}
      </a>
      <button type="button" onClick={p.onCustomize} className="mb-4 rounded-skin-sm border border-line bg-surface p-3 text-left hover:border-line-strong">
        <span className="flex items-center gap-3">
          <Avatar avatar={p.profile.avatar} name={p.profile.display_name} size={40} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{p.profile.display_name}</span>
            <span className="display block text-xs font-bold text-accent-ink">Lv {p.stats.level} · ×{p.stats.current_streak} combo</span>
          </span>
        </span>
        <span className="mt-2.5 block">
          <XpBar stats={p.stats} label={false} />
        </span>
      </button>
      <button type="button" onClick={p.onPalette} className="mb-3 flex items-center gap-2 rounded-skin-sm border border-line bg-surface-2 px-3 py-2 text-sm text-muted hover:text-ink">
        <Search className="size-4 shrink-0" aria-hidden="true" /> <span className="whitespace-nowrap">Search…</span>
        <span className="ml-auto flex gap-0.5"><kbd className="kbd">⌘</kbd><kbd className="kbd">K</kbd></span>
      </button>
      <nav aria-label="Views" className="space-y-0.5">
        {NAV.map((n) => (
          <NavLink key={n.view} active={p.view === n.view} href={PATH_OF[n.view]} go={p.go} badge={p.counts[n.view]} danger={n.view === 'overdue'}>
            <n.icon className="size-4" aria-hidden="true" /> {n.label}
          </NavLink>
        ))}
      </nav>
      {p.projects.length > 0 && (
        <nav aria-label="Projects" className="mt-5 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Projects</p>
          {p.projects.map((pr) => (
            <NavLink key={pr.id} active={p.view === 'project' && p.projectId === pr.id} href={`/project/${pr.id}`} go={p.go} badge={p.projectCounts.get(pr.id)}>
              <Folder className="size-4" style={{ color: pr.color }} aria-hidden="true" /> <span className="truncate">{pr.name}</span>
            </NavLink>
          ))}
        </nav>
      )}
      <div className="mt-auto flex items-center gap-1 border-t border-line pt-3">
        <button type="button" onClick={p.onCustomize} className="btn flex-1 justify-start px-2 text-muted hover:bg-surface-2 hover:text-ink">
          <Palette className="size-4" aria-hidden="true" /> Customize
        </button>
        <button type="button" onClick={p.onHelp} className="rounded p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Keyboard shortcuts">
          <Keyboard className="size-4" />
        </button>
        {p.onSignOut && (
          <button type="button" onClick={p.onSignOut} className="rounded p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        )}
      </div>
    </aside>
  )
}

const TABS: Exclude<ViewId, 'project'>[] = ['hq', 'today', 'upcoming', 'log']

export function MobileNav(p: NavProps) {
  const [more, setMore] = useState(false)
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-panel/90 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <button type="button" onClick={p.onCustomize} aria-label="Customize player">
            <Avatar avatar={p.profile.avatar} name={p.profile.display_name} size={36} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="display flex items-baseline justify-between text-xs font-bold">
              <span className="text-accent-ink">Lv {p.stats.level}</span>
              <span className="text-muted">×{p.stats.current_streak} combo · {p.stats.total_xp - p.stats.level_floor}/{p.stats.level_next - p.stats.level_floor} XP</span>
            </p>
            <div className="mt-1">
              <XpBar stats={p.stats} label={false} />
            </div>
          </div>
          <button type="button" onClick={p.onPalette} className="rounded p-2 text-muted" aria-label="Search">
            <Search className="size-5" />
          </button>
        </div>
      </header>
      <nav aria-label="Views" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {TABS.map((v) => {
          const n = NAV.find((x) => x.view === v)!
          const active = p.view === v
          return (
            <a key={v} href={PATH_OF[v]} aria-current={active ? 'page' : undefined} onClick={(e) => { e.preventDefault(); p.go(PATH_OF[v]) }} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${active ? 'text-accent-ink' : 'text-muted'}`}>
              <n.icon className="size-5" aria-hidden="true" />
              {v === 'today' ? 'Today' : v === 'log' ? 'Log' : n.label}
              {!!p.counts[v] && v === 'today' && <span className="absolute right-[22%] top-1 size-2 rounded-full bg-accent" aria-hidden="true" />}
            </a>
          )
        })}
        <button type="button" onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold text-muted" aria-haspopup="dialog">
          <Menu className="size-5" aria-hidden="true" /> More
        </button>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="More">
        <nav aria-label="More views" className="space-y-0.5">
          {NAV.filter((n) => !TABS.includes(n.view)).map((n) => (
            <NavLink key={n.view} active={p.view === n.view} href={PATH_OF[n.view]} go={(h) => { setMore(false); p.go(h) }} badge={p.counts[n.view]} danger={n.view === 'overdue'}>
              <n.icon className="size-4" aria-hidden="true" /> {n.label}
            </NavLink>
          ))}
          {p.projects.map((pr) => (
            <NavLink key={pr.id} active={p.projectId === pr.id} href={`/project/${pr.id}`} go={(h) => { setMore(false); p.go(h) }} badge={p.projectCounts.get(pr.id)}>
              <Folder className="size-4" style={{ color: pr.color }} aria-hidden="true" /> {pr.name}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
          <button type="button" className="btn btn-ghost" onClick={() => { setMore(false); p.onCustomize() }}>
            <Palette className="size-4" aria-hidden="true" /> Customize
          </button>
          {p.onSignOut && (
            <button type="button" className="btn btn-ghost" onClick={p.onSignOut}>
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
          )}
        </div>
      </Modal>
    </>
  )
}
