import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return {
    session,
    ready,
    enabled: !!supabase,
    async signIn(email: string, password: string) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email: string, password: string) {
      const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      if (error) throw error
      return { needsConfirm: !data.session }
    },
    async guest() {
      const { error } = await supabase!.auth.signInAnonymously()
      if (error) throw error
    },
    async signOut() {
      await supabase?.auth.signOut()
    },
  }
}
