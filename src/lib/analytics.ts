// Google Analytics 4 loader. No-op unless VITE_GA_ID is set, so dev/preview don't
// pollute the data — set VITE_GA_ID (e.g. G-XXXXXXX) in the Vercel env to enable.
// gtag.js and the collect endpoint send CORP: cross-origin, so this works under
// our COEP require-corp (cross-origin isolation) policy.

interface GtagWindow {
  dataLayer: unknown[]
  gtag: (...args: unknown[]) => void
}

export function initAnalytics(id: string | undefined = import.meta.env.VITE_GA_ID): void {
  if (!id) return

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)

  const w = window as unknown as GtagWindow
  w.dataLayer = w.dataLayer || []
  // Must push the `arguments` object, not a rest-param array: gtag.js only treats
  // Arguments entries as commands and silently ignores plain arrays.
  w.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments)
  }
  w.gtag('js', new Date())
  w.gtag('config', id)
}

// Fire a GA4 event. No-op when GA isn't loaded (dev, preview, blocked).
// Keep params to counts/enums — never send track titles or file names.
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  const w = window as unknown as Partial<GtagWindow>
  w.gtag?.('event', name, params)
}
