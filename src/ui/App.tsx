import { useEffect, useState } from 'react'
import SetBuilder from '@/ui/SetBuilder'
import Footer from '@/ui/Footer'
import SavedSetsMenu from '@/ui/SavedSetsMenu'
import { SavedSetsProvider } from '@/state/saved-sets'
import { PrivacyPolicy, Terms } from '@/ui/Legal'
import SharedSetView from '@/ui/SharedSetView'
import BpmKeyFinder from '@/ui/BpmKeyFinder'
import CamelotWheelPage from '@/ui/CamelotWheelPage'
import ConsentBanner from '@/ui/ConsentBanner'
import SiteNav, { type NavPage } from '@/ui/SiteNav'
import { SHARE_ID_PATTERN } from '@/share/schema'
import { FINDER_PATH, WHEEL_PATH, linkHandler, useLocation } from '@/lib/navigate'

type Page = 'app' | 'shared' | 'finder' | 'wheel' | 'privacy' | 'terms'

/** Share id from a /s/:id path (shared-set links), or null. */
function sharedSetId(path: string): string | null {
  const id = /^\/s\/([^/]+)\/?$/.exec(path)?.[1]
  return id && SHARE_ID_PATTERN.test(id) ? id : null
}

const TITLES: Partial<Record<Page, string>> = {
  app: 'mixbuilder — Free AI DJ Set Builder',
  finder: 'BPM & Key Finder — free, in your browser | mixbuilder',
  wheel: 'Camelot Wheel — interactive harmonic mixing chart | mixbuilder',
}

export default function App() {
  // Hidden on the landing hero, where the wordmark lives big and centered.
  const [hasContent, setHasContent] = useState(false)
  const { path, hash } = useLocation()
  const shareId = sharedSetId(path)
  const cleanPath = path.replace(/\/$/, '')
  const onFinderPath = cleanPath === FINDER_PATH
  const onWheelPath = cleanPath === WHEEL_PATH
  const page: Page =
    hash === '#/privacy'
      ? 'privacy'
      : hash === '#/terms'
        ? 'terms'
        : shareId
          ? 'shared'
          : onFinderPath
            ? 'finder'
            : onWheelPath
              ? 'wheel'
              : 'app'
  const showWordmark = page !== 'app' || hasContent
  // The empty landing fits in one viewport (no scroll) from the sm breakpoint up; on
  // phones it's taller than the screen, so it scrolls. The app scrolls once built.
  const isLanding = page === 'app' && !hasContent
  const navPage: NavPage | null =
    page === 'app' ? 'builder' : page === 'finder' || page === 'wheel' ? page : null

  useEffect(() => {
    const title = TITLES[page]
    if (title) document.title = title
  }, [page])

  return (
    <SavedSetsProvider>
      <div
        className={`flex flex-col ${isLanding ? 'min-h-screen sm:h-screen sm:overflow-hidden' : 'min-h-screen'}`}
      >
        {/* On the landing the wordmark lives in the hero, so the links sit centered. */}
        <header
          className={`sticky top-0 z-20 flex items-center gap-4 px-4 py-2.5 ${
            showWordmark ? 'justify-between' : 'justify-center'
          }`}
        >
          {showWordmark && (
            <a
              href="/"
              onClick={linkHandler('/')}
              className="text-lg font-semibold tracking-tight text-neutral-100"
            >
              mix<span className="text-signal-500">builder</span>
            </a>
          )}
          <div className="flex items-center gap-1 sm:gap-2">
            <SiteNav current={navPage} />
            <SavedSetsMenu />
          </div>
        </header>
        <main className={`flex-1 px-4 ${isLanding ? 'flex items-center py-4 sm:min-h-0' : 'py-8'}`}>
          {/* Kept mounted (just hidden) on other pages so an in-progress set survives navigation. */}
          <div
            className={
              page !== 'app'
                ? 'hidden'
                : isLanding
                  ? 'flex w-full flex-1 items-center justify-center sm:min-h-0 sm:overflow-hidden'
                  : undefined
            }
          >
            <SetBuilder onContentChange={setHasContent} />
          </div>
          {page === 'shared' && shareId && <SharedSetView id={shareId} />}
          {/* Kept mounted under a legal page opened from it, so results survive. */}
          {onFinderPath && (
            <div className={page === 'finder' ? undefined : 'hidden'}>
              <BpmKeyFinder />
            </div>
          )}
          {onWheelPath && (
            <div className={page === 'wheel' ? undefined : 'hidden'}>
              <CamelotWheelPage />
            </div>
          )}
          {page === 'privacy' && <PrivacyPolicy />}
          {page === 'terms' && <Terms />}
        </main>
        <Footer />
        <ConsentBanner />
      </div>
    </SavedSetsProvider>
  )
}
