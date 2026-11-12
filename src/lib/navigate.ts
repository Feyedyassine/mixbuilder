import { useEffect, useState, type MouseEvent } from 'react'

// Minimal client-side navigation for the few real paths (/, /s/:id, /tools/…).
// In-app links use navigate() so the builder — kept mounted across pages — never
// loses an in-progress set to a full page load. Legal pages stay on hash routes.

const PATH_EVENT = 'mb:pathchange'

export const FINDER_PATH = '/tools/bpm-key-finder'
export const WHEEL_PATH = '/tools/camelot-wheel'

export function navigate(path: string): void {
  if (path === window.location.pathname + window.location.hash) return
  window.history.pushState(null, '', path)
  window.dispatchEvent(new Event(PATH_EVENT))
  window.scrollTo(0, 0)
}

/** onClick for <a href> links: SPA-navigate on plain left clicks, default otherwise. */
export function linkHandler(path: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(path)
  }
}

/** Current path + hash, updated on navigate(), back/forward and hash changes. */
export function useLocation(): { path: string; hash: string } {
  const read = () => ({ path: window.location.pathname, hash: window.location.hash })
  const [location, setLocation] = useState(read)
  useEffect(() => {
    const sync = () => setLocation(read())
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    window.addEventListener(PATH_EVENT, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
      window.removeEventListener(PATH_EVENT, sync)
    }
  }, [])
  return location
}
