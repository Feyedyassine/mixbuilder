// Google Analytics 4 loader with consent. No-op unless VITE_GA_ID is set, so
// dev/preview don't pollute the data — set VITE_GA_ID (e.g. G-XXXXXXX) in the
// Vercel env to enable. gtag.js and the collect endpoint send CORP: cross-origin,
// so this works under our COEP require-corp (cross-origin isolation) policy.
//
// Consent: visitors whose timezone is in the EU/EEA/UK/Switzerland must opt in
// before GA (and its cookies) loads — the ConsentBanner asks. Everyone else gets
// GA by default, and anyone can opt out via "Cookie settings". Ad signals are
// always denied; mixbuilder runs no ads.

interface GtagWindow {
  dataLayer: unknown[]
  gtag: (...args: unknown[]) => void
}

export type Consent = 'granted' | 'denied'

const CONSENT_KEY = 'mb-analytics-consent'
/** Fired on window to (re)open the consent banner, e.g. from "Cookie settings". */
export const OPEN_CONSENT_EVENT = 'mb:open-consent'

// Timezones outside Europe/* that are in the EU/EEA (outermost regions, Cyprus,
// Iceland, Svalbard). Europe/* already covers the UK and Switzerland.
const CONSENT_TIMEZONES = new Set([
  'Asia/Nicosia',
  'Asia/Famagusta',
  'Atlantic/Azores',
  'Atlantic/Madeira',
  'Atlantic/Canary',
  'Atlantic/Faroe',
  'Atlantic/Reykjavik',
  'Arctic/Longyearbyen',
  'America/Guadeloupe',
  'America/Martinique',
  'America/Cayenne',
  'America/Marigot',
  'America/St_Barthelemy',
  'Indian/Reunion',
  'Indian/Mayotte',
])

let gaId: string | undefined

/** True when the visitor is likely in a region where analytics needs opt-in. */
export function consentRequired(): boolean {
  let tz = ''
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    return true // can't tell — ask
  }
  return tz.startsWith('Europe/') || CONSENT_TIMEZONES.has(tz)
}

export function storedConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

/** True once initAnalytics ran with a GA id (i.e. analytics exists to consent to). */
export function analyticsEnabled(): boolean {
  return !!gaId
}

/** Whether the banner should be shown: GA is configured, consent needed, not yet given. */
export function shouldAskConsent(): boolean {
  return !!gaId && consentRequired() && storedConsent() === null
}

function loadGa(id: string): void {
  const w = window as unknown as GtagWindow
  if (typeof w.gtag === 'function') return

  w.dataLayer = w.dataLayer || []
  // Must push the `arguments` object, not a rest-param array: gtag.js only treats
  // Arguments entries as commands and silently ignores plain arrays.
  w.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments)
  }
  w.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
  w.gtag('js', new Date())
  w.gtag('config', id)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)
}

/** Delete GA's first-party cookies (_ga, _ga_<id>) on this host and parent domains. */
function clearGaCookies(): void {
  const names = document.cookie
    .split(';')
    .map((c) => c.split('=')[0]!.trim())
    .filter((n) => n === '_ga' || n.startsWith('_ga_'))
  const parts = location.hostname.split('.')
  const domains = [''].concat(parts.map((_, i) => `; domain=.${parts.slice(i).join('.')}`))
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`
    }
  }
}

export function initAnalytics(id: string | undefined = import.meta.env.VITE_GA_ID): void {
  if (!id) return
  gaId = id
  const consent = storedConsent()
  if (consent === 'denied') return
  if (consentRequired() && consent !== 'granted') return
  loadGa(id)
}

/** GA's documented kill switch: while set, gtag.js sends nothing for this id. */
function setGaDisabled(disabled: boolean): void {
  if (gaId) (window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = disabled
}

/** Record the visitor's choice and apply it immediately. */
export function setConsent(consent: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, consent)
  } catch {
    // Storage blocked: the choice applies to this page view only.
  }
  const w = window as unknown as Partial<GtagWindow>
  if (consent === 'granted') {
    setGaDisabled(false)
    if (gaId) loadGa(gaId)
    w.gtag?.('consent', 'update', { analytics_storage: 'granted' })
  } else {
    w.gtag?.('consent', 'update', { analytics_storage: 'denied' })
    setGaDisabled(true)
    clearGaCookies()
  }
}

/** True when events would actually be sent (GA loaded, consent not withdrawn). */
export function analyticsActive(): boolean {
  const w = window as unknown as Partial<GtagWindow> & Record<string, unknown>
  return typeof w.gtag === 'function' && !(gaId && w[`ga-disable-${gaId}`] === true)
}

// Fire a GA4 event. No-op when GA isn't loaded (dev, preview, blocked, no consent).
// Keep params to counts/enums — never send track titles or file names.
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  const w = window as unknown as Partial<GtagWindow>
  w.gtag?.('event', name, params)
}
