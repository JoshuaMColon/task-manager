import { useCallback, useSyncExternalStore } from 'react'
import type { ViewId } from '../lib/views'

export interface Route {
  view: ViewId
  projectId?: string
  demo: boolean
}

const PATHS: Record<string, ViewId> = { '/': 'hq', '/today': 'today', '/upcoming': 'upcoming', '/inbox': 'inbox', '/overdue': 'overdue', '/log': 'log', '/trophies': 'trophies' }
export const PATH_OF: Record<Exclude<ViewId, 'project'>, string> = { hq: '/', today: '/today', upcoming: '/upcoming', inbox: '/inbox', overdue: '/overdue', log: '/log', trophies: '/trophies' }

export function parsePath(path: string): Route {
  const p = path.replace(/\/+$/, '') || '/'
  if (p === '/demo') return { view: 'hq', demo: true }
  const m = /^\/project\/([0-9a-z-]+)$/i.exec(p)
  if (m) return { view: 'project', projectId: m[1], demo: false }
  return { view: PATHS[p] ?? 'hq', demo: false }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('popstate', cb)
  return () => window.removeEventListener('popstate', cb)
}

export function navigate(path: string, replace = false) {
  if (path === window.location.pathname) return
  window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): [Route, (path: string) => void] {
  const path = useSyncExternalStore(subscribe, () => window.location.pathname, () => '/')
  const go = useCallback((p: string) => {
    navigate(p)
    window.scrollTo({ top: 0 })
  }, [])
  return [parsePath(path), go]
}
