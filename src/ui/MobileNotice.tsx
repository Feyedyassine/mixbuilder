import { useState } from 'react'
import { trackEvent } from '@/lib/analytics'

// Phones are ~28% of visitors but rarely hold a DJ library, so most leave without
// adding a track. On phones only, the landing suggests sending the link to a
// computer (native share sheet, or copy as a fallback). Adding tracks still works.

const PHONE_QUERY = '(max-width: 639px) and (pointer: coarse)'

function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(PHONE_QUERY).matches === true
}

export default function MobileNotice() {
  const [copied, setCopied] = useState(false)
  if (!isPhone()) return null

  const url = `${window.location.origin}/`

  const send = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'mixbuilder — free DJ set builder',
          text: 'Open mixbuilder on my computer',
          url,
        })
        trackEvent('mobile_link_sent', { method: 'share' })
      } catch {
        // Dismissing the share sheet rejects; nothing to do.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      trackEvent('mobile_link_sent', { method: 'copy' })
    } catch {
      // Clipboard blocked; the URL is short enough to type.
    }
  }

  return (
    <section className="w-full rounded-lg border border-neutral-800 bg-neutral-900/95 p-4 text-left">
      <p className="text-sm font-semibold text-neutral-200">On your phone?</p>
      <p className="mt-1 text-sm text-neutral-400">
        mixbuilder works best on a computer, where your music library and DJ software live. Send
        yourself the link and open it there.
      </p>
      <button
        className="mt-3 rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-neutral-100"
        onClick={() => void send()}
      >
        {copied ? 'Link copied' : 'Send me the link'}
      </button>
    </section>
  )
}
