import { useState } from 'react'
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { useSession } from '@/state/useSession'

// Compact header auth control: a top-right "Sign in" button that opens a small
// dropdown (email link + Google), or the signed-in email with a Sign-out menu.

export default function AuthMenu() {
  const { session, loading } = useSession()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  if (!isSupabaseConfigured()) {
    return <span className="text-xs text-neutral-600">sign-in unavailable</span>
  }
  if (loading) return <span className="text-xs text-neutral-500">…</span>

  const close = () => {
    setOpen(false)
    setMessage(null)
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
    <div className="relative">
      <button
        className="rounded bg-neutral-800 px-3 py-1 text-sm text-neutral-200 hover:bg-neutral-700"
        onClick={() => setOpen((v) => !v)}
      >
        {session ? (
          <span className="max-w-[12rem] truncate">{session.user.email ?? 'Account'} ▾</span>
        ) : (
          'Sign in'
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-xl">
            {session ? (
              <div className="flex flex-col gap-2">
                <p className="truncate text-xs text-neutral-500">{session.user.email}</p>
                <button
                  className="rounded bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700"
                  onClick={() => {
                    void getSupabaseClient().auth.signOut()
                    close()
                  }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-neutral-500">
                  Sign in to save sets and sync across devices.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="min-w-0 flex-1 rounded bg-neutral-800 px-2 py-1 text-sm outline-none"
                  />
                  <button
                    className="rounded bg-indigo-600 px-2 py-1 text-sm hover:bg-indigo-500 disabled:opacity-40"
                    onClick={() => void sendMagicLink()}
                    disabled={!email}
                  >
                    Send
                  </button>
                </div>
                <button
                  className="rounded bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700"
                  onClick={() => void signInWithGoogle()}
                >
                  Continue with Google
                </button>
                {message && <p className="text-xs text-neutral-400">{message}</p>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
