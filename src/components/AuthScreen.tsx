import { useState } from 'react'
import { Gamepad2, Loader2 } from 'lucide-react'

interface Props {
  onSignIn(email: string, password: string): Promise<void>
  onSignUp(email: string, password: string): Promise<{ needsConfirm: boolean }>
  onGuest(): void
}

export function AuthScreen({ onSignIn, onSignUp, onGuest }: Props) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)

  const submit = async () => {
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'in') await onSignIn(email, password)
      else {
        const r = await onSignUp(email, password)
        if (r.needsConfirm) setMsg({ tone: 'info', text: 'Check your inbox to confirm your email, then sign in.' })
      }
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : 'Could not sign in' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto size-14" />
          <h1 className="display mt-3 text-4xl font-extrabold">XPlan</h1>
          <p className="mt-1 text-muted">Level up your to-do list. Every task is a quest.</p>
        </div>
        <div className="card framed p-6">
          <div role="tablist" aria-label="Account" className="mb-5 grid grid-cols-2 rounded-skin-sm bg-surface-2 p-1">
            {(['in', 'up'] as const).map((m) => (
              <button key={m} role="tab" type="button" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-skin-sm py-2 text-sm font-bold ${mode === m ? 'bg-surface text-ink shadow-skin' : 'text-muted'}`}>
                {m === 'in' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            className="space-y-3"
          >
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-muted">Email</span>
              <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-muted">Password</span>
              <input className="field" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {msg && (
              <p role={msg.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${msg.tone === 'error' ? 'text-danger' : 'text-success'}`}>
                {msg.text}
              </p>
            )}
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {mode === 'in' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" onClick={onGuest} className="btn btn-ghost w-full">
            <Gamepad2 className="size-4" aria-hidden="true" /> Play as guest (demo save)
          </button>
          <p className="mt-3 text-center text-xs text-muted">Guest saves are wiped after 24 hours.</p>
        </div>
      </div>
    </main>
  )
}
