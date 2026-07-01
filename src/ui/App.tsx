export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-neutral-950 text-neutral-100">
      <h1 className="text-4xl font-bold tracking-tight">djmix</h1>
      <p className="text-neutral-400">AI DJ set builder — your audio never leaves this device.</p>
      <p className="text-sm text-neutral-600">
        crossOriginIsolated: {String(globalThis.crossOriginIsolated)}
      </p>
    </main>
  )
}
