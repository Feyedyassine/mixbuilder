import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when both env vars are present (copy .env.example to .env.local to set them). */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

let client: SupabaseClient<Database> | null = null

/**
 * Memoized Supabase client. Throws only when actually called without configuration,
 * so unconfigured environments (CI, a fresh clone) still build and render.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and set ' +
        'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  client = createClient<Database>(url, anonKey)
  return client
}
