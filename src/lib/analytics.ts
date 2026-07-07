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
  w.gtag = (...args: unknown[]) => {
    w.dataLayer.push(args)
  }
  w.gtag('js', new Date())
  w.gtag('config', id)
}
