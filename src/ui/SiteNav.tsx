import { useEffect, useRef, type MouseEvent } from 'react'
import { FINDER_PATH, WHEEL_PATH, linkHandler } from '@/lib/navigate'

// Header links to each page. App pages navigate in-app (the builder keeps its
// state); FAQ is a static page, so it's a normal link. On phones the links fold
// into a <details> "Menu" — native, so the static pages' copies work without JS.
// Keep in sync with the static copies in index.html, faq.html and tools/*.html.

export type NavPage = 'builder' | 'finder' | 'wheel' | 'faq'

const LINKS: { page: NavPage; href: string; label: string; inApp: boolean }[] = [
  { page: 'builder', href: '/', label: 'Set builder', inApp: true },
  { page: 'finder', href: FINDER_PATH, label: 'BPM & key finder', inApp: true },
  { page: 'wheel', href: WHEEL_PATH, label: 'Camelot wheel', inApp: true },
  { page: 'faq', href: '/faq', label: 'FAQ', inApp: false },
]

export default function SiteNav({ current }: { current: NavPage | null }) {
  const menu = useRef<HTMLDetailsElement>(null)

  // Close the phone menu on any tap outside it.
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) {
        menu.current.open = false
      }
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const link = (l: (typeof LINKS)[number], inMenu: boolean) => (
    <a
      key={l.page}
      href={l.href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (menu.current) menu.current.open = false
        if (l.inApp) linkHandler(l.href)(e)
      }}
      aria-current={l.page === current ? 'page' : undefined}
      className={`whitespace-nowrap rounded-lg transition ${
        inMenu ? 'block px-3 py-2 hover:bg-neutral-800' : 'px-2.5 py-1.5'
      } ${l.page === current ? 'text-neutral-100' : 'text-neutral-400 hover:text-neutral-100'}`}
    >
      {l.label}
    </a>
  )

  return (
    <nav aria-label="Main" className="text-sm">
      <div className="hidden items-center sm:flex">{LINKS.map((l) => link(l, false))}</div>
      <details ref={menu} className="relative sm:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg border border-neutral-800 px-2.5 py-1.5 text-neutral-300 [&::-webkit-details-marker]:hidden">
          Menu <span className="text-[10px]">▾</span>
        </summary>
        <div className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-xl">
          {LINKS.map((l) => link(l, true))}
        </div>
      </details>
    </nav>
  )
}
