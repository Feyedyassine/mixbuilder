import { useState } from 'react'
import { useSavedSets } from '@/state/saved-sets'

/** Header dropdown for saved sets — reachable from any screen, including the landing. */
export default function SavedSetsMenu() {
  const sets = useSavedSets()
  const [open, setOpen] = useState(false)

  if (!sets.signedIn || sets.sets.length === 0) return null

  const openSet = (id: string) => {
    window.location.assign('#/') // leave any legal page so the opened set is visible
    void sets.open(id)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-600 hover:text-neutral-100"
        onClick={() => setOpen((v) => !v)}
      >
        Sets ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 max-h-[70vh] w-64 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-xl">
            {sets.sets.map((s) => (
              <div key={s.id} className="flex items-center gap-1">
                <button
                  className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-800"
                  onClick={() => openSet(s.id)}
                >
                  {s.name}
                  {s.id === sets.currentId && <span className="ml-1 text-signal-500">•</span>}
                </button>
                <button
                  className="rounded px-1.5 py-1 text-xs text-neutral-500 hover:text-neutral-200"
                  onClick={() => {
                    const name = window.prompt('Rename set', s.name)
                    if (name) void sets.rename(s.id, name)
                  }}
                >
                  ✎
                </button>
                <button
                  className="rounded px-1.5 py-1 text-xs text-neutral-500 hover:text-red-400"
                  onClick={() => void sets.remove(s.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
