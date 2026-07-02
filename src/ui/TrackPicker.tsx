import { useState } from 'react'
import { isDirectoryPickerSupported, pickAudioDirectory, pickAudioFiles } from '@/ingestion/pick'
import { ingestFiles, type IngestProgress } from '@/ingestion/ingest'
import type { TrackFile } from '@/ingestion/types'

// Minimal ingestion demo (plan Chunk 2.1). Phase 4 (Chunk 4.1) builds the real
// intake screen; this proves the pick → hash → tags flow in the running app.
export default function TrackPicker() {
  const [tracks, setTracks] = useState<TrackFile[]>([])
  const [progress, setProgress] = useState<IngestProgress | null>(null)
  const [busy, setBusy] = useState(false)

  const add = async (pick: () => Promise<Awaited<ReturnType<typeof pickAudioFiles>>>) => {
    const picked = await pick()
    if (picked.length === 0) return
    setBusy(true)
    try {
      const ingested = await ingestFiles(picked, { onProgress: setProgress })
      setTracks((prev) => {
        const byHash = new Map(prev.map((t) => [t.contentHash, t]))
        for (const t of ingested) byHash.set(t.contentHash, t)
        return [...byHash.values()]
      })
    } finally {
      setProgress(null)
      setBusy(false)
    }
  }

  return (
    <section className="flex w-full max-w-md flex-col items-center gap-3">
      <div className="flex gap-2">
        <button
          className="rounded bg-indigo-600 px-3 py-1 text-sm hover:bg-indigo-500 disabled:opacity-40"
          onClick={() => void add(pickAudioFiles)}
          disabled={busy}
        >
          Add tracks
        </button>
        {isDirectoryPickerSupported() && (
          <button
            className="rounded bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 disabled:opacity-40"
            onClick={() => void add(pickAudioDirectory)}
            disabled={busy}
          >
            Add folder
          </button>
        )}
      </div>

      {progress && (
        <p className="text-sm text-neutral-500">
          Reading {progress.done}/{progress.total}… {progress.current}
        </p>
      )}

      {tracks.length > 0 && (
        <ul className="w-full divide-y divide-neutral-800 text-sm">
          {tracks.map((t) => (
            <li key={t.id} className="flex items-baseline justify-between gap-3 py-1">
              <span className="truncate">
                <span className="text-neutral-200">{t.tags.title ?? t.name}</span>
                {t.tags.artist && <span className="text-neutral-500"> — {t.tags.artist}</span>}
              </span>
              <span className="shrink-0 font-mono text-xs text-neutral-600">
                {(t.size / 1_000_000).toFixed(1)} MB · {t.contentHash.slice(0, 8)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
