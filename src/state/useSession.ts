import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

export interface SessionState {
  session: Session | null
  loading: boolean
}

/**
 * Tracks the current Supabase auth session and keeps it in sync with sign-in/out.
 * Returns loading=false with session=null when Supabase isn't configured yet.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null)
  // Only "loading" when there's actually a session to fetch.
  const [loading, setLoading] = useState(() => isSupabaseConfigured())

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const supabase = getSupabaseClient()
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}
