import { useState } from 'react'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { useSession } from '@/state/useSession'

// Minimal auth harness proving the Supabase wiring (plan Chunk 1.2). Phase 4
// (Chunk 4.1) replaces this with the real sign-in screens.
export default function AuthPanel() {
  const { session, loading } = useSession()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-amber-400">
        Supabase not configured — copy <code>.env.example</code> to <code>.env.local</code> and set
        your project URL and anon key.
      </p>
    )
  }

  if (loading) return <p className="text-sm text-neutral-500">Checking session…</p>

  if (session) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-neutral-300">
          Signed in as {session.user.email ?? session.user.id}
        </p>
        <button
          className="rounded bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700"
          onClick={() => void getSupabaseClient().auth.signOut()}
        >
          Sign out
        </button>
      </div>
    )
  }

  const sendMagicLink = async () => {
    setMessage(null)
    const { error } = await getSupabaseClient().auth.signInWithOtp({ email })
    setMessage(error ? error.message : 'Check your email for a sign-in link.')
  }

  const signInWithGoogle = async () => {
    setMessage(null)
    const { error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setMessage(error.message)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded bg-neutral-800 px-3 py-1 text-sm outline-none"
        />
        <button
          className="rounded bg-indigo-600 px-3 py-1 text-sm hover:bg-indigo-500 disabled:opacity-40"
          onClick={() => void sendMagicLink()}
          disabled={!email}
        >
          Email link
        </button>
      </div>
      <button
        className="rounded bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700"
        onClick={() => void signInWithGoogle()}
      >
        Continue with Google
      </button>
      {message && <p className="text-sm text-neutral-400">{message}</p>}
    </div>
  )
}
