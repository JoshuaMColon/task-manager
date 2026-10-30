import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null when the env vars aren't set: the app then runs local-only (localStorage save file). */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'xplan-auth' } }) : null

/**
 * Data lives in the dedicated `xplan` schema. The Data API reaches it through thin
 * security_invoker views (public.xplan_*), so RLS on xplan.* applies.
 */
export const VIEWS = {
  tasks: 'xplan_tasks',
  projects: 'xplan_projects',
  profiles: 'xplan_profiles',
  achievements: 'xplan_achievements',
} as const
