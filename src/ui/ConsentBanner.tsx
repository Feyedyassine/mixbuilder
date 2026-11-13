import { useEffect, useState } from 'react'
import { OPEN_CONSENT_EVENT, setConsent, shouldAskConsent, type Consent } from '@/lib/analytics'
import { reportCapabilitiesOnce } from '@/lib/capabilities'

// Analytics consent prompt. Shown on first visit where opt-in is required (see
// consentRequired) and whenever "Cookie settings" is clicked. Decline is as
// prominent as Accept; the choice is stored and applied immediately.

export default function ConsentBanner() {
  const [open, setOpen] = useState(shouldAskConsent)

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_CONSENT_EVENT, show)
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, show)
  }, [])

  if (!open) return null

  const choose = (consent: Consent) => {
    setConsent(consent)
    setOpen(false)
    if (consent === 'granted') void reportCapabilitiesOnce()
  }

  return (
    <section
      aria-label="Analytics cookies"
      className="fixed inset-x-0 bottom-0 z-40 p-3 sm:bottom-4 sm:flex sm:justify-center"
    >
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl sm:max-w-xl">
        <p className="text-sm text-neutral-300">
          Can we use Google Analytics cookies to see how mixbuilder is used? It helps us improve the
          app — it never includes your music, track names or sets.{' '}
          <a href="#/privacy" className="text-signal-500 hover:text-signal-400">
            Privacy policy
          </a>
        </p>
        <div className="mt-3 flex gap-2">
          <button
            className="flex-1 rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-neutral-100"
            onClick={() => choose('denied')}
          >
            Decline
          </button>
          <button
            className="flex-1 rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-neutral-100"
            onClick={() => choose('granted')}
          >
            Accept
          </button>
        </div>
      </div>
    </section>
  )
}
