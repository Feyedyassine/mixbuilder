import { useEffect, useState } from 'react'
import { isDirectoryPickerSupported, pickAudioDirectory, pickAudioFiles } from '@/ingestion/pick'
import { ingestFiles, type IngestProgress } from '@/ingestion/ingest'
import type { TrackFile } from '@/ingestion/types'
import { analyzeAudioFile, disposeAnalysisPool } from '@/analysis/analysis-service'
import type { TrackFeatures } from '@/analysis/feature-schema'

// Minimal ingestion + analysis demo (plan Chunks 2.1–2.2). Phase 4 builds the
// real intake + timeline; this proves pick → hash → decode → analyze end-to-end
// in the running app.

type Analysis = TrackFeatures | 'analyzing' | { error: true }

export default function TrackPicker() {
  const [tracks, setTracks] = useState<TrackFile[]>([])
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({})
  const [progress, setProgress] = useState<IngestProgress | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => disposeAnalysisPool, [])

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

  const analyzeAll = async () => {
    setBusy(true)
    try {
      for (const track of tracks) {
        if (analyses[track.contentHash] && analyses[track.contentHash] !== 'analyzing') continue
        setAnalyses((prev) => ({ ...prev, [track.contentHash]: 'analyzing' }))
        try {
          const features = await analyzeAudioFile(track.file)
          setAnalyses((prev) => ({ ...prev, [track.contentHash]: features }))
        } catch {
          setAnalyses((prev) => ({ ...prev, [track.contentHash]: { error: true } }))
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex w-full max-w-lg flex-col items-center gap-3">
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
        {tracks.length > 0 && (
          <button
            className="rounded bg-emerald-700 px-3 py-1 text-sm hover:bg-emerald-600 disabled:opacity-40"
            onClick={() => void analyzeAll()}
            disabled={busy}
          >
            Analyze
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
              <span className="shrink-0 font-mono text-xs text-neutral-400">
                {renderAnalysis(analyses[t.contentHash])}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function renderAnalysis(a: Analysis | undefined): string {
  if (!a) return '—'
  if (a === 'analyzing') return 'analyzing…'
  if ('error' in a) return 'failed'
  return `${a.tempo.bpm.toFixed(1)} BPM · ${a.key.camelot || a.key.key} · energy ${a.energy.score}`
}
