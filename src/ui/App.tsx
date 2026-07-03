import AuthMenu from '@/ui/AuthMenu'
import SetBuilder from '@/ui/SetBuilder'

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800 px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold tracking-tight">djmix</h1>
          <span className="hidden text-xs text-neutral-500 sm:inline">
            AI DJ set builder — audio never leaves your device
          </span>
        </div>
        <AuthMenu />
      </header>
      <main className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-8">
        <SetBuilder />
      </main>
    </div>
  )
}
