import { useEffect, useMemo, useState } from 'react'
import { isDirectoryPickerSupported, pickAudioDirectory, pickAudioFiles } from '@/ingestion/pick'
import { ingestFiles, type IngestProgress } from '@/ingestion/ingest'
import type { TrackFile } from '@/ingestion/types'
import { analyzeAudioFile, disposeAnalysisPool } from '@/analysis/analysis-service'
import type { TrackFeatures } from '@/analysis/feature-schema'
import { optimizeSet, type AnalyzedTrack, type SequencedSet } from '@/sequencing/sequencer'
import { computeFits, type TrackFit } from '@/sequencing/fit'
import { ARC_LABELS, type ArcName } from '@/sequencing/arc'

type Analysis = TrackFeatures | 'analyzing' | { error: true }

const ARCS: ArcName[] = ['warmup', 'peak', 'journey', 'flat']

export default function SetBuilder() {
  const [tracks, setTracks] = useState<TrackFile[]>([])
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({})
  const [benched, setBenched] = useState<Set<string>>(new Set())
  const [arc, setArc] = useState<ArcName>('journey')
  const [anchors, setAnchors] = useState<{ start?: string; end?: string }>({})
  const [progress, setProgress] = useState<IngestProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [built, setBuilt] = useState<SequencedSet | null>(null)

  useEffect(() => disposeAnalysisPool, [])

  // Analyzed, non-benched tracks + their fit within the active set.
  const { active, fitsById } = useMemo(() => {
    const activeTracks: AnalyzedTrack[] = tracks
      .filter((t) => !benched.has(t.contentHash))
      .map((t) => ({ track: t, a: analyses[t.contentHash] }))
      .filter((x): x is { track: TrackFile; a: TrackFeatures } => isFeatures(x.a))
      .map((x) => ({ id: x.track.contentHash, features: x.a }))
    const fits = new Map<string, TrackFit>()
    for (const f of computeFits(activeTracks)) fits.set(f.id, f)
    return { active: activeTracks, fitsById: fits }
  }, [tracks, analyses, benched])

  const addTracks = async (pick: () => Promise<Awaited<ReturnType<typeof pickAudioFiles>>>) => {
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
        if (isFeatures(analyses[track.contentHash])) continue
        setAnalyses((p) => ({ ...p, [track.contentHash]: 'analyzing' }))
        try {
          const features = await analyzeAudioFile(track.file)
          setAnalyses((p) => ({ ...p, [track.contentHash]: features }))
        } catch {
          setAnalyses((p) => ({ ...p, [track.contentHash]: { error: true } }))
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const buildSet = () => {
    if (active.length < 2) return
    const has = (id?: string) => id && active.some((t) => t.id === id)
    setBuilt(
      optimizeSet(active, {
        arc,
        startId: has(anchors.start) ? anchors.start : undefined,
        endId: has(anchors.end) ? anchors.end : undefined,
      }),
    )
  }

  const toggleBench = (id: string) =>
    setBenched((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAnchor = (which: 'start' | 'end', id: string) =>
    setAnchors((prev) => ({ ...prev, [which]: prev[which] === id ? undefined : id }))

  const titleOf = (id: string) => tracks.find((t) => t.contentHash === id)?.tags.title ?? id

  return (
    <section className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={btn.primary}
          onClick={() => void addTracks(pickAudioFiles)}
          disabled={busy}
        >
          Add tracks
        </button>
        {isDirectoryPickerSupported() && (
          <button
            className={btn.subtle}
            onClick={() => void addTracks(pickAudioDirectory)}
            disabled={busy}
          >
            Add folder
          </button>
        )}
        {tracks.length > 0 && (
          <button className={btn.subtle} onClick={() => void analyzeAll()} disabled={busy}>
            Analyze
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {ARCS.map((a) => (
            <button key={a} onClick={() => setArc(a)} className={a === arc ? btn.chipOn : btn.chip}>
              {ARC_LABELS[a]}
            </button>
          ))}
          <button className={btn.build} onClick={buildSet} disabled={busy || active.length < 2}>
            Build set
          </button>
        </div>
      </div>

      {progress && (
        <p className="text-sm text-neutral-500">
          Reading {progress.done}/{progress.total}… {progress.current}
        </p>
      )}

      {tracks.length > 0 && (
        <ul className="divide-y divide-neutral-800 rounded border border-neutral-800 text-sm">
          {tracks.map((t) => {
            const a = analyses[t.contentHash]
            const fit = fitsById.get(t.contentHash)
            const isBenched = benched.has(t.contentHash)
            return (
              <li
                key={t.contentHash}
                className={`flex items-center gap-3 px-3 py-1.5 ${isBenched ? 'opacity-40' : ''}`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {t.tags.title ?? t.name}
                  {t.tags.artist && <span className="text-neutral-500"> — {t.tags.artist}</span>}
                  {fit?.isMisfit && (
                    <span className="ml-2 text-amber-400" title={fit.reasons.join('; ')}>
                      ⚠ misfit
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-xs text-neutral-400">{describe(a)}</span>
                <span className="flex shrink-0 gap-1">
                  <button
                    className={anchors.start === t.contentHash ? tag.on : tag.off}
                    onClick={() => toggleAnchor('start', t.contentHash)}
                    title="Pin as first track"
                  >
                    start
                  </button>
                  <button
                    className={anchors.end === t.contentHash ? tag.on : tag.off}
                    onClick={() => toggleAnchor('end', t.contentHash)}
                    title="Pin as last track"
                  >
                    end
                  </button>
                  <button className={tag.off} onClick={() => toggleBench(t.contentHash)}>
                    {isBenched ? 'restore' : 'bench'}
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {built && <BuiltSet set={built} titleOf={titleOf} />}
    </section>
  )
}

function BuiltSet({ set, titleOf }: { set: SequencedSet; titleOf: (id: string) => string }) {
  return (
    <div className="rounded border border-emerald-900 bg-emerald-950/30 p-3">
      <p className="mb-2 text-sm text-neutral-300">
        {ARC_LABELS[set.arc]} set · {set.order.length} tracks · flow{' '}
        {(set.totalScore * 100).toFixed(0)}%
      </p>
      <ol className="text-sm">
        {set.order.map((t, i) => {
          const tr = i > 0 ? set.transitions[i - 1] : null
          return (
            <li key={t.id}>
              {tr && (
                <div className="flex items-center gap-2 py-0.5 pl-4 text-xs text-neutral-500">
                  <span>↓ {(tr.score.total * 100).toFixed(0)}%</span>
                  {tr.warnings.map((w) => (
                    <span key={w} className="text-amber-400">
                      {w}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-baseline gap-2 py-0.5">
                <span className="w-5 text-right font-mono text-neutral-600">{i + 1}</span>
                <span className="truncate">{titleOf(t.id)}</span>
                <span className="ml-auto shrink-0 font-mono text-xs text-neutral-500">
                  {t.features.tempo.bpm.toFixed(0)} · {t.features.key.camelot}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function isFeatures(a: Analysis | undefined): a is TrackFeatures {
  return !!a && a !== 'analyzing' && !('error' in a)
}

function describe(a: Analysis | undefined): string {
  if (!a) return '—'
  if (a === 'analyzing') return 'analyzing…'
  if ('error' in a) return 'failed'
  return `${a.tempo.bpm.toFixed(0)} · ${a.key.camelot || a.key.key} · e${a.energy.score}`
}

const btn = {
  primary: 'rounded bg-indigo-600 px-3 py-1 text-sm hover:bg-indigo-500 disabled:opacity-40',
  subtle: 'rounded bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 disabled:opacity-40',
  build: 'rounded bg-emerald-700 px-3 py-1 text-sm hover:bg-emerald-600 disabled:opacity-40',
  chip: 'rounded px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200',
  chipOn: 'rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-100',
}

const tag = {
  off: 'rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-700',
  on: 'rounded bg-indigo-600 px-1.5 py-0.5 text-xs text-white',
}
