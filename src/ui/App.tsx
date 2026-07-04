import { useState } from 'react'
import AuthMenu from '@/ui/AuthMenu'
import SetBuilder from '@/ui/SetBuilder'

export default function App() {
  // Hidden on the landing hero, where the wordmark lives big and centered.
  const [hasContent, setHasContent] = useState(false)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-neutral-800/70 bg-neutral-950/80 px-4 py-2.5 backdrop-blur">
        {hasContent ? (
          <h1 className="text-lg font-semibold tracking-tight text-neutral-100">
            mix<span className="text-signal-500">builder</span>
          </h1>
        ) : (
          <span />
        )}
        <AuthMenu />
      </header>
      <main className="px-4 py-8">
        <SetBuilder onContentChange={setHasContent} />
      </main>
    </div>
  )
}
