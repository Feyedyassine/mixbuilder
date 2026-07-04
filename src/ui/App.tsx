import AuthMenu from '@/ui/AuthMenu'
import SetBuilder from '@/ui/SetBuilder'

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-neutral-800/70 bg-neutral-950/80 px-4 py-2.5 backdrop-blur">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-lg font-semibold tracking-tight text-neutral-100">
            mix<span className="text-signal-500">builder</span>
          </h1>
          <span className="hidden font-mono text-[11px] text-neutral-600 sm:inline">
            audio never leaves your device
          </span>
        </div>
        <AuthMenu />
      </header>
      <main className="px-4 py-8">
        <SetBuilder />
      </main>
    </div>
  )
}
