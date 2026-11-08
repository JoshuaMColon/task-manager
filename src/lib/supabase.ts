import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// One client for the whole app. I persist and refresh the session under my own
// storage key so a reload stays signed in, and so this token doesn't collide
// with the other projects on the same Supabase instance.
// null when the env vars aren't set: the app then runs on a localStorage save file.
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'xplan-auth' } }) : null

// The Data API doesn't expose the xplan schema (that's a dashboard setting),
// so reads and writes go through these security_invoker views. The views add
// no privileges — RLS on xplan.* still applies to whoever is calling.
export const VIEWS = {
  tasks: 'xplan_tasks',
  projects: 'xplan_projects',
  profiles: 'xplan_profiles',
  achievements: 'xplan_achievements',
} as const
