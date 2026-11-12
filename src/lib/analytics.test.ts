import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// analytics.ts keeps the GA id in module state, so each test imports a fresh copy.
type Analytics = typeof import('@/lib/analytics')
let a: Analytics

type GaWindow = Window & {
  gtag?: (...args: unknown[]) => void
  dataLayer?: unknown[]
  [key: string]: unknown
}
const w = window as unknown as GaWindow

function inTimezone(timeZone: string) {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone }) }) as unknown as Intl.DateTimeFormat,
  )
}

const gaScripts = () => document.head.querySelectorAll('script[src*="googletagmanager"]').length

beforeEach(async () => {
  vi.resetModules()
  a = await import('@/lib/analytics')
})

afterEach(() => {
  vi.restoreAllMocks()
  document.head.querySelectorAll('script').forEach((s) => s.remove())
  delete w.gtag
  delete w.dataLayer
  delete w['ga-disable-G-TEST']
  localStorage.clear()
  document.cookie = '_ga=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
})

describe('consentRequired', () => {
  it.each([
    ['Europe/Paris', true],
    ['Europe/London', true],
    ['Asia/Nicosia', true],
    ['Atlantic/Canary', true],
    ['America/New_York', false],
    ['Asia/Kolkata', false],
  ])('%s → %s', (tz, expected) => {
    inTimezone(tz)
    expect(a.consentRequired()).toBe(expected)
  })
})

describe('in a consent region', () => {
  beforeEach(() => inTimezone('Europe/Berlin'))

  it('does not load GA until consent, and asks for it', () => {
    a.initAnalytics('G-TEST')
    expect(gaScripts()).toBe(0)
    expect(w.gtag).toBeUndefined()
    expect(a.shouldAskConsent()).toBe(true)
  })

  it('loads GA on accept, with ad signals denied, and remembers the choice', () => {
    a.initAnalytics('G-TEST')
    a.setConsent('granted')
    expect(gaScripts()).toBe(1)
    expect(a.storedConsent()).toBe('granted')
    expect(a.shouldAskConsent()).toBe(false)
    const commands = w.dataLayer!.map((entry) => Array.from(entry as ArrayLike<unknown>))
    expect(commands).toContainEqual([
      'consent',
      'default',
      expect.objectContaining({ ad_storage: 'denied', analytics_storage: 'granted' }),
    ])
    expect(commands).toContainEqual(['config', 'G-TEST'])
  })

  it('loads on a later visit once consent was given', () => {
    localStorage.setItem('mb-analytics-consent', 'granted')
    a.initAnalytics('G-TEST')
    expect(gaScripts()).toBe(1)
  })

  it('stays off after decline', () => {
    a.initAnalytics('G-TEST')
    a.setConsent('denied')
    expect(gaScripts()).toBe(0)
    expect(a.storedConsent()).toBe('denied')
    expect(a.shouldAskConsent()).toBe(false)
  })
})

describe('outside consent regions', () => {
  beforeEach(() => inTimezone('America/Chicago'))

  it('loads GA immediately and does not ask', () => {
    a.initAnalytics('G-TEST')
    expect(gaScripts()).toBe(1)
    expect(a.shouldAskConsent()).toBe(false)
  })

  it('respects an earlier opt-out', () => {
    localStorage.setItem('mb-analytics-consent', 'denied')
    a.initAnalytics('G-TEST')
    expect(gaScripts()).toBe(0)
  })

  it('withdrawing consent disables GA and deletes its cookie', () => {
    a.initAnalytics('G-TEST')
    document.cookie = '_ga=GA1.1.123.456; path=/'
    a.setConsent('denied')
    expect(w['ga-disable-G-TEST']).toBe(true)
    expect(document.cookie).not.toContain('_ga=')
    const last = Array.from(w.dataLayer!.at(-1) as ArrayLike<unknown>)
    expect(last).toEqual(['consent', 'update', { analytics_storage: 'denied' }])
  })
})

describe('gtag shim', () => {
  it('queues commands as Arguments objects (gtag.js ignores plain arrays)', () => {
    inTimezone('America/Chicago')
    a.initAnalytics('G-TEST')
    a.trackEvent('set_built', { track_count: 3 })
    for (const entry of w.dataLayer!) {
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
    }
  })

  it('is a no-op without a GA id', () => {
    inTimezone('Europe/Paris')
    a.initAnalytics(undefined)
    expect(gaScripts()).toBe(0)
    expect(a.shouldAskConsent()).toBe(false)
    expect(a.analyticsEnabled()).toBe(false)
  })
})
