import { FINDER_PATH, linkHandler } from '@/lib/navigate'

// Header links to each page. App pages navigate in-app (the builder keeps its
// state); FAQ is a static page, so it's a normal link. Short labels on phones, and
// when the wordmark is showing (it links home) phones drop "Builder" to fit.
// Keep in sync with the static copies in index.html, faq.html and tools/*.html.

export type NavPage = 'builder' | 'finder' | 'faq'

const LINKS: { page: NavPage; href: string; label: string; short: string; inApp: boolean }[] = [
  { page: 'builder', href: '/', label: 'Set builder', short: 'Builder', inApp: true },
  { page: 'finder', href: FINDER_PATH, label: 'BPM & key finder', short: 'BPM & key', inApp: true },
  { page: 'faq', href: '/faq', label: 'FAQ', short: 'FAQ', inApp: false },
]

export default function SiteNav({
  current,
  withWordmark,
}: {
  current: NavPage | null
  withWordmark: boolean
}) {
  return (
    <nav aria-label="Main" className="flex items-center text-sm">
      {LINKS.map((l) => (
        <a
          key={l.page}
          href={l.href}
          onClick={l.inApp ? linkHandler(l.href) : undefined}
          aria-current={l.page === current ? 'page' : undefined}
          className={`whitespace-nowrap rounded-lg px-1.5 py-1.5 transition sm:px-2.5 ${
            withWordmark && l.page === 'builder' ? 'hidden sm:inline' : ''
          } ${l.page === current ? 'text-neutral-100' : 'text-neutral-400 hover:text-neutral-100'}`}
        >
          <span className="sm:hidden">{l.short}</span>
          <span className="hidden sm:inline">{l.label}</span>
        </a>
      ))}
    </nav>
  )
}
