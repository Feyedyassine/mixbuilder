import { useEffect, useState } from 'react'
import AuthMenu from '@/ui/AuthMenu'
import SetBuilder from '@/ui/SetBuilder'
import Footer from '@/ui/Footer'
import { PrivacyPolicy, Terms } from '@/ui/Legal'

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return hash
}

export default function App() {
  // Hidden on the landing hero, where the wordmark lives big and centered.
  const [hasContent, setHasContent] = useState(false)
  const hash = useHashRoute()
  const page = hash === '#/privacy' ? 'privacy' : hash === '#/terms' ? 'terms' : 'app'
  const showWordmark = page !== 'app' || hasContent
  // The empty landing fits in one viewport (no scroll); the app scrolls once built.
  const isLanding = page === 'app' && !hasContent

  return (
    <div className={`flex flex-col ${isLanding ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <header
        className={`sticky top-0 z-20 flex items-center justify-between gap-4 px-4 py-2.5 ${
          isLanding ? '' : 'border-b border-neutral-800/70 bg-neutral-950/80 backdrop-blur'
        }`}
      >
        {showWordmark ? (
          <a href="#/" className="text-lg font-semibold tracking-tight text-neutral-100">
            mix<span className="text-signal-500">builder</span>
          </a>
        ) : (
          <span />
        )}
        <AuthMenu />
      </header>
      <main className={`flex-1 px-4 ${isLanding ? 'flex min-h-0 items-center py-4' : 'py-8'}`}>
        {/* Kept mounted (just hidden) on legal pages so an in-progress set survives navigation. */}
        <div
          className={
            page !== 'app'
              ? 'hidden'
              : isLanding
                ? 'flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden'
                : undefined
          }
        >
          <SetBuilder onContentChange={setHasContent} />
        </div>
        {page === 'privacy' && <PrivacyPolicy />}
        {page === 'terms' && <Terms />}
      </main>
      <Footer />
    </div>
  )
}
