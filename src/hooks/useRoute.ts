import { useCallback, useSyncExternalStore } from 'react'
import type { ViewId } from '../lib/views'

export interface Route {
  view: ViewId
  projectId?: string
  demo: boolean
}

const PATHS: Record<string, ViewId> = { '/': 'hq', '/today': 'today', '/upcoming': 'upcoming', '/inbox': 'inbox', '/overdue': 'overdue', '/log': 'log', '/trophies': 'trophies' }
export const PATH_OF: Record<Exclude<ViewId, 'project'>, string> = { hq: '/', today: '/today', upcoming: '/upcoming', inbox: '/inbox', overdue: '/overdue', log: '/log', trophies: '/trophies' }

// No router dependency. The path lives in history and I listen for popstate
// so back and forward work on a static host. /demo is not a view — it's a
// flag the shell reads to start a guest, then replaces with / once the save loads.
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
  // pushState doesn't fire popstate. I dispatch one so useSyncExternalStore
  // re-reads the path. replace is used for /demo -> / so that redirect isn't
  // a history entry the back button returns to.
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
