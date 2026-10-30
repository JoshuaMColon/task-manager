import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Crown, X } from 'lucide-react'
import { ACHIEVEMENT_BY_CODE } from '../lib/achievements'
import { rankTitle } from '../lib/xp'

interface Pop {
  id: number
  x: number
  y: number
  text: string
}
interface Toast {
  id: number
  kind: 'level' | 'trophy' | 'info' | 'error'
  title: string
  body?: string
  action?: { label: string; run: () => void }
  level?: number
  code?: string
}

interface FeedbackApi {
  pop(x: number, y: number, text: string): void
  toast(t: Omit<Toast, 'id'>, ms?: number): void
  levelUp(level: number): void
  trophy(code: string): void
  buzz(pattern?: number | number[]): void
}

const Ctx = createContext<FeedbackApi | null>(null)
// eslint-disable-next-line react-refresh/only-export-components
export const useFeedback = () => useContext(Ctx)!

const SPARKS = 10

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pops, setPops] = useState<Pop[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [live, setLive] = useState('')
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])

  const api = useMemo<FeedbackApi>(() => {
    const buzz = (pattern: number | number[] = 12) => {
      if (window.matchMedia('(pointer: coarse)').matches && 'vibrate' in navigator) navigator.vibrate?.(pattern)
    }
    const toast: FeedbackApi['toast'] = (t, ms = 4200) => {
      const id = ++seq.current
      setToasts((ts) => [...ts.slice(-3), { ...t, id }])
      setLive(`${t.title}${t.body ? `. ${t.body}` : ''}`)
      setTimeout(() => dismiss(id), ms)
    }
    return {
      buzz,
      toast,
      pop(x, y, text) {
        const id = ++seq.current
        setPops((ps) => [...ps, { id, x, y, text }])
        setLive(text)
        setTimeout(() => setPops((ps) => ps.filter((p) => p.id !== id)), 1200)
      },
      levelUp(level) {
        buzz([18, 40, 18, 40, 60])
        toast({ kind: 'level', title: `Level ${level}`, body: `Rank: ${rankTitle(level)}`, level }, 5200)
      },
      trophy(code) {
        const a = ACHIEVEMENT_BY_CODE.get(code)
        if (!a) return
        toast({ kind: 'trophy', title: `Trophy unlocked: ${a.name}`, body: a.desc, code }, 5000)
      },
    }
  }, [dismiss])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="sr-only">
        {live}
      </div>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70]">
        {pops.map((p) => (
          <div key={p.id} style={{ left: p.x, top: p.y }} className="absolute">
            <span className="anim-pop display absolute left-0 top-0 whitespace-nowrap text-lg font-extrabold text-accent-ink drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">{p.text}</span>
            {Array.from({ length: SPARKS }, (_, i) => (
              <span
                key={i}
                className="anim-spark absolute left-0 top-0 size-1.5 rounded-full bg-accent"
                style={{ ['--a' as string]: `${(360 / SPARKS) * i + 8}deg`, ['--d' as string]: `${26 + (i % 3) * 10}px` }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:items-end">
        {toasts.map((t) =>
          t.kind === 'level' ? (
            <div key={t.id} role="status" className="anim-level pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-skin border border-accent/60 bg-surface p-4 shadow-skin">
              <div className="anim-shine absolute inset-0 overflow-hidden" />
              <div className="relative flex items-center gap-4">
                <div className="hex grid size-14 shrink-0 place-items-center bg-accent text-on-accent">
                  <Crown className="size-7" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="display text-xs font-bold text-accent-ink">Level up!</p>
                  <p className="display text-2xl font-extrabold leading-tight">{t.title}</p>
                  <p className="text-sm text-muted">{t.body}</p>
                </div>
                <button type="button" onClick={() => dismiss(t.id)} className="rounded p-1 text-muted hover:text-ink" aria-label="Dismiss">
                  <X className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            <Toasty key={t.id} t={t} onClose={() => dismiss(t.id)} />
          ),
        )}
      </div>
    </Ctx.Provider>
  )
}

function Toasty({ t, onClose }: { t: Toast; onClose: () => void }) {
  const meta = t.code ? ACHIEVEMENT_BY_CODE.get(t.code) : undefined
  const Icon = meta?.icon
  return (
    <div role={t.kind === 'error' ? 'alert' : 'status'} className={`anim-toast pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-skin border bg-surface px-4 py-3 shadow-skin ${t.kind === 'error' ? 'border-danger/50' : t.kind === 'trophy' ? 'border-gold/50' : 'border-line'}`}>
      {Icon && (
        <span className="hex grid size-9 shrink-0 place-items-center bg-gold text-surface">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{t.title}</p>
        {t.body && <p className="truncate text-xs text-muted">{t.body}</p>}
      </div>
      {t.action && (
        <button
          type="button"
          className="rounded px-2 py-1 text-sm font-bold text-accent-ink hover:bg-surface-2"
          onClick={() => {
            t.action!.run()
            onClose()
          }}
        >
          {t.action.label}
        </button>
      )}
      <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:text-ink" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  )
}
