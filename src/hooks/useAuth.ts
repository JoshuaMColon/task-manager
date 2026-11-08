import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Who is signed in. I keep this thin on purpose: the hook only reports the
// session, and the shell decides whether to show the form or build a backend.
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  // No Supabase client means there is no token to wait for, so the shell can render now.
  const [ready, setReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    // The persisted session (storage key xplan-auth) is enough to choose a screen.
    // I don't treat it as proof of identity — RLS on the server accepts or rejects the request.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    // Password sign-in, sign-out, token refresh, and the anonymous guest all arrive here.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return {
    session,
    ready,
    enabled: !!supabase,
    async signIn(email: string, password: string) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password })
      // Throw so the form can show Supabase's message. A success has no return value;
      // onAuthStateChange is what actually moves the shell into the game.
      if (error) throw error
    },
    async signUp(email: string, password: string) {
      // The confirm link has to come back to this origin. When the project requires
      // confirmation, Supabase returns no session and the screen stays put.
      const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      if (error) throw error
      return { needsConfirm: !data.session }
    },
    async guest() {
      // Anonymous sign-in. The JWT carries is_anonymous, which xplan_start_demo
      // checks before it will write a seeded save onto this user.
      const { error } = await supabase!.auth.signInAnonymously()
      if (error) throw error
    },
    async signOut() {
      await supabase?.auth.signOut()
    },
  }
}
