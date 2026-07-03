import AuthPanel from '@/ui/AuthPanel'
import SetBuilder from '@/ui/SetBuilder'

export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-neutral-950 px-4 py-12 text-neutral-100">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-4xl font-bold tracking-tight">djmix</h1>
        <p className="text-neutral-400">AI DJ set builder — your audio never leaves this device.</p>
      </div>
      <AuthPanel />
      <SetBuilder />
      <p className="mt-auto text-sm text-neutral-600">
        crossOriginIsolated: {String(globalThis.crossOriginIsolated)}
      </p>
    </main>
  )
}
