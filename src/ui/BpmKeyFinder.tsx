import { useState } from 'react'
import { isDirectoryPickerSupported, pickAudioDirectory, pickAudioFiles } from '@/ingestion/pick'
import { ingestFiles } from '@/ingestion/ingest'
import type { TrackFile } from '@/ingestion/types'
import { analyzeWithCache } from '@/analysis/cached-analysis'
import type { TrackFeatures } from '@/analysis/feature-schema'
import { defaultPoolSize } from '@/analysis/worker-pool'
import { runWithConcurrency } from '@/lib/concurrency'
import { trackEvent } from '@/lib/analytics'
import { WHEEL_PATH, linkHandler, navigate } from '@/lib/navigate'
import { handOffTracks } from '@/state/track-handoff'
import { formatMusicalKey, formatTime } from '@/export/format'
import { finderResultsText } from '@/tools/finder-text'
import { KeyChip, TrackCover } from '@/ui/track-visuals'

// /tools/bpm-key-finder — one job: tempo + key for the tracks you add. Same
// engine and cache as the builder; "Build a set" hands the analyzed tracks over
// so nothing is re-added or re-analyzed. Keep in sync with the prerendered copy
// in tools/bpm-key-finder.html.

type Result = TrackFeatures | 'analyzing' | { error: true }

const isFeatures = (r: Result | undefined): r is TrackFeatures =>
  typeof r === 'object' && !('error' in r)

const primary =
  'rounded-lg bg-signal-500 px-5 py-2.5 font-semibold text-neutral-950 transition hover:bg-signal-400 disabled:cursor-not-allowed disabled:opacity-40'
const secondary =
  'rounded-lg border border-neutral-700 px-5 py-2.5 font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-neutral-100 disabled:opacity-40'

export default function BpmKeyFinder() {
  const [tracks, setTracks] = useState<TrackFile[]>([])
  const [results, setResults] = useState<Record<string, Result>>({})
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const add = async (pick: typeof pickAudioFiles, via: 'files' | 'folder') => {
    const picked = await pick()
    if (picked.length === 0) return
    trackEvent('finder_tracks_added', { track_count: picked.length, via })
    setBusy(true)
    setCopied(false)
    try {
      const ingested = await ingestFiles(picked, {
        onProgress: (p) => setStatus(`reading ${p.done}/${p.total}`),
      })
      const fresh = ingested.filter((t) => !tracks.some((x) => x.contentHash === t.contentHash))
      setTracks((prev) => [...prev, ...fresh])
      setResults((prev) => ({
        ...prev,
        ...Object.fromEntries(fresh.map((t) => [t.contentHash, 'analyzing' as const])),
      }))
      let done = 0
      setStatus(`analyzing 0/${fresh.length}`)
      await runWithConcurrency(fresh, defaultPoolSize(), async (t) => {
        try {
          const { features } = await analyzeWithCache(t.file, t.contentHash)
          setResults((prev) => ({ ...prev, [t.contentHash]: features }))
        } catch {
          setResults((prev) => ({ ...prev, [t.contentHash]: { error: true } }))
        } finally {
          done += 1
          setStatus(`analyzing ${done}/${fresh.length}`)
        }
      })
    } finally {
      setStatus(null)
      setBusy(false)
    }
  }

  const analyzed = tracks.flatMap((t) => {
    const r = results[t.contentHash]
    return isFeatures(r) ? [{ track: t, features: r }] : []
  })

  const copyResults = async () => {
    const text = finderResultsText(
      analyzed.map(({ track, features }) => ({
        title: track.tags.title ?? track.name,
        artist: track.tags.artist,
        camelot: features.key.camelot,
        musicalKey: formatMusicalKey(features.key),
        bpm: features.tempo.bpm,
      })),
    )
    await navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true)
        trackEvent('finder_results_copied', { track_count: analyzed.length })
      },
      () => {},
    )
  }

  const buildSet = () => {
    const analyses: Record<string, TrackFeatures | { error: true }> = {}
    for (const t of tracks) {
      const r = results[t.contentHash]
      if (r && r !== 'analyzing') analyses[t.contentHash] = r
    }
    handOffTracks({ tracks, analyses })
    trackEvent('finder_to_builder', { track_count: analyzed.length })
    navigate('/')
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-100 sm:text-4xl">
          BPM &amp; Key Finder
        </h1>
        <p className="text-neutral-300">
          Find the tempo and musical key of your tracks, in Camelot and standard notation.{' '}
          <span className="text-signal-500">Free</span> — and nothing is uploaded: analysis runs in
          your browser.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={primary}
            onClick={() => void add(pickAudioFiles, 'files')}
            disabled={busy}
          >
            Add tracks
          </button>
          {isDirectoryPickerSupported() && (
            <button
              className={secondary}
              onClick={() => void add(pickAudioDirectory, 'folder')}
              disabled={busy}
            >
              Add folder
            </button>
          )}
          <span className="font-mono text-xs text-purple-400">{status}</span>
        </div>
      </div>

      {tracks.length > 0 && (
        <>
          <ol className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/95">
            {tracks.map((t) => {
              const r = results[t.contentHash]
              return (
                <li
                  key={t.contentHash}
                  className="flex items-center gap-3 border-b border-neutral-800/60 px-4 py-2.5 last:border-b-0"
                >
                  <TrackCover cover={t.tags.cover} camelot={isFeatures(r) ? r.key.camelot : ''} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-neutral-100">
                      {t.tags.title ?? t.name}
                    </div>
                    {t.tags.artist && (
                      <div className="truncate text-xs text-neutral-500">{t.tags.artist}</div>
                    )}
                  </div>
                  {r === 'analyzing' && (
                    <span className="animate-pulse text-xs text-purple-400">analyzing…</span>
                  )}
                  {r && typeof r === 'object' && 'error' in r && (
                    <span className="text-xs text-red-400">couldn’t analyze</span>
                  )}
                  {isFeatures(r) && <ResultCells features={r} />}
                </li>
              )
            })}
          </ol>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className={primary}
              onClick={buildSet}
              disabled={busy || analyzed.length < 2}
              title={analyzed.length < 2 ? 'Add at least 2 tracks' : undefined}
            >
              Build a set with these tracks →
            </button>
            <button
              className={secondary}
              onClick={() => void copyResults()}
              disabled={!analyzed.length}
            >
              {copied ? 'Copied' : 'Copy results'}
            </button>
          </div>
        </>
      )}

      <section className="grid gap-4 text-sm text-neutral-400 sm:grid-cols-3">
        <div>
          <h2 className="mb-1 font-semibold text-neutral-200">Camelot keys</h2>
          <p>
            Codes like 8A or 9B make harmonic mixing easy: tracks with the same number, one number
            apart, or the same number with the other letter mix in key.{' '}
            <a
              href={WHEEL_PATH}
              onClick={linkHandler(WHEEL_PATH)}
              className="text-signal-500 hover:text-signal-400"
            >
              Explore the Camelot wheel →
            </a>
          </p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold text-neutral-200">Private by design</h2>
          <p>Your files never leave your device. Supports MP3, WAV, FLAC, M4A and AAC.</p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold text-neutral-200">Then build a set</h2>
          <p>
            mixbuilder can order the same tracks into a set that flows — by key, tempo and energy.
          </p>
        </div>
      </section>
    </div>
  )
}

function ResultCells({ features }: { features: TrackFeatures }) {
  const musicalKey = formatMusicalKey(features.key)
  const energy = Math.max(0, Math.min(10, features.energy.score))
  return (
    <>
      <div className="flex items-center gap-1.5">
        <KeyChip camelot={features.key.camelot} musicalKey={musicalKey} />
        <span className="w-8 text-xs text-neutral-400">{musicalKey}</span>
      </div>
      <span className="w-14 shrink-0 text-right font-mono text-sm tabular-nums text-neutral-200">
        {features.tempo.bpm.toFixed(0)}
        <span className="ml-0.5 text-[9px] text-neutral-600">bpm</span>
      </span>
      <span
        className="hidden h-1.5 w-12 shrink-0 overflow-hidden rounded bg-neutral-800 sm:block"
        title={`Energy ${energy.toFixed(1)}/10`}
      >
        <span className="block h-full bg-signal-500" style={{ width: `${energy * 10}%` }} />
      </span>
      <span className="hidden w-10 shrink-0 text-right font-mono text-xs tabular-nums text-neutral-500 sm:block">
        {formatTime(features.durationSec)}
      </span>
    </>
  )
}
