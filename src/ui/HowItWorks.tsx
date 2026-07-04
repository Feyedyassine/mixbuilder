// First-run onboarding shown before any tracks are added. Frames the value prop
// and — most importantly — makes the privacy claim credible rather than a slogan.

const STEPS: { title: string; body: string }[] = [
  { title: 'Add your tracks', body: 'They stay on your device — nothing is uploaded.' },
  { title: 'We analyze each one', body: 'BPM, key, energy, and structure, right in your browser.' },
  { title: 'Pick an energy arc', body: 'mixbuilder sequences a set that flows.' },
  { title: 'Export or save', body: 'Rekordbox, M3U8, or a printable set sheet.' },
]

export default function HowItWorks() {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-300">How it works</h2>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-neutral-200">{s.title}</p>
              <p className="text-xs text-neutral-500">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
