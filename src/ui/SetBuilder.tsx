import { useCallback, useEffect, useMemo, useState } from 'react'
import { isDirectoryPickerSupported, pickAudioDirectory, pickAudioFiles } from '@/ingestion/pick'
import { ingestFiles, type IngestProgress } from '@/ingestion/ingest'
import type { TrackFile } from '@/ingestion/types'
import { disposeAnalysisPool } from '@/analysis/analysis-service'
import { analyzeWithCache } from '@/analysis/cached-analysis'
import type { TrackFeatures } from '@/analysis/feature-schema'
import { defaultPoolSize } from '@/analysis/worker-pool'
import { runWithConcurrency } from '@/lib/concurrency'
import { useSession } from '@/state/useSession'
import {
  optimizeSet,
  sequenceInOrder,
  type AnalyzedTrack,
  type SequencedSet,
} from '@/sequencing/sequencer'
import { computeFits, type TrackFit } from '@/sequencing/fit'
import { ARC_LABELS, type ArcName } from '@/sequencing/arc'
import { localGet } from '@/storage/idb-cache'
import { communityGet } from '@/storage/community-cache'
import {
  deleteSet,
  listSets,
  loadSet,
  renameSet,
  saveSet,
  serializeSet,
  type SetSummary,
} from '@/storage/sets-store'
import { buildSetExport, type TrackDisplay } from '@/export/build'
import { toM3U8 } from '@/export/m3u8'
import { toRekordboxXml } from '@/export/rekordbox'
import { toSetSheet } from '@/export/setsheet'
import { downloadText, safeFileStem } from '@/export/download'

type Analysis = TrackFeatures | 'analyzing' | { error: true }

const ARCS: ArcName[] = ['warmup', 'peak', 'journey', 'flat']

export default function SetBuilder() {
  const [tracks, setTracks] = useState<TrackFile[]>([])
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({})
  const [benched, setBenched] = useState<Set<string>>(new Set())
  const [arc, setArc] = useState<ArcName>('journey')
  const [anchors, setAnchors] = useState<{ start?: string; end?: string }>({})
  const [progress, setProgress] = useState<IngestProgress | null>(null)
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [built, setBuilt] = useState<SequencedSet | null>(null)
  const [builtDisplay, setBuiltDisplay] = useState<Map<string, TrackDisplay>>(new Map())
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set())
  const [savedSets, setSavedSets] = useState<SetSummary[]>([])
  const [currentSetId, setCurrentSetId] = useState<string | null>(null)
  const [setName, setSetName] = useState('My set')
  const [loadNote, setLoadNote] = useState<string | null>(null)
  const { session } = useSession()
  const userId = session?.user.id

  useEffect(() => disposeAnalysisPool, [])

  const refreshSaved = useCallback(async () => {
    // Always await before setState so this stays off the synchronous-effect path.
    const sets = await (userId ? listSets() : Promise.resolve<SetSummary[]>([]))
    setSavedSets(sets)
  }, [userId])

  useEffect(() => {
    // Loads saved sets from the DB; setState happens after an await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSaved()
  }, [refreshSaved])

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
    const pending = tracks.filter((t) => !isFeatures(analyses[t.contentHash]))
    if (pending.length === 0) return
    setBusy(true)
    let done = 0
    setAnalyzeProgress({ done, total: pending.length })
    try {
      // Run up to pool-size analyses at once: saturates the workers without
      // holding every decoded track in memory simultaneously.
      await runWithConcurrency(pending, defaultPoolSize(), async (track) => {
        setAnalyses((p) => ({ ...p, [track.contentHash]: 'analyzing' }))
        try {
          const { features, source } = await analyzeWithCache(track.file, track.contentHash, {
            signedIn: !!session,
          })
          setAnalyses((p) => ({ ...p, [track.contentHash]: features }))
          if (source !== 'fresh') setCachedIds((prev) => new Set(prev).add(track.contentHash))
        } catch {
          setAnalyses((p) => ({ ...p, [track.contentHash]: { error: true } }))
        } finally {
          done += 1
          setAnalyzeProgress({ done, total: pending.length })
        }
      })
    } finally {
      setAnalyzeProgress(null)
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
    setBuiltDisplay(displayById)
    setCurrentSetId(null) // a fresh arrangement — Save creates a new set
    setLoadNote(null)
  }

  const saveCurrent = async () => {
    if (!built || !userId) return
    const id = await saveSet(
      userId,
      setName,
      serializeSet(built, builtDisplay),
      currentSetId ?? undefined,
    )
    if (id) setCurrentSetId(id)
    await refreshSaved()
  }

  const openSet = async (id: string) => {
    const record = await loadSet(id)
    if (!record) return
    // Re-fetch features by hash from the caches; files may be absent on this device.
    const resolved: AnalyzedTrack[] = []
    const display = new Map<string, TrackDisplay>()
    for (const ref of record.data.tracks) {
      display.set(ref.hash, { fileName: ref.fileName, title: ref.title, artist: ref.artist })
      const features = (await localGet(ref.hash)) ?? (userId ? await communityGet(ref.hash) : null)
      if (features) resolved.push({ id: ref.hash, features })
    }
    setBuilt(sequenceInOrder(resolved, { arc: record.data.arc }))
    setBuiltDisplay(display)
    setCurrentSetId(id)
    setSetName(record.name)
    const missing = record.data.tracks.length - resolved.length
    setLoadNote(
      missing > 0
        ? `${missing} of ${record.data.tracks.length} tracks aren't analyzed on this device — re-add the files to include them.`
        : null,
    )
  }

  const removeSet = async (id: string) => {
    await deleteSet(id)
    if (id === currentSetId) setCurrentSetId(null)
    await refreshSaved()
  }

  const renameSetTo = async (id: string, name: string) => {
    await renameSet(id, name)
    await refreshSaved()
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

  const displayById = new Map<string, TrackDisplay>()
  for (const t of tracks) {
    displayById.set(t.contentHash, {
      fileName: t.name,
      title: t.tags.title ?? t.name,
      artist: t.tags.artist,
    })
  }

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

      {analyzeProgress && (
        <p className="text-sm text-neutral-500">
          Analyzing {analyzeProgress.done}/{analyzeProgress.total}…
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
                <span className="shrink-0 font-mono text-xs text-neutral-400">
                  {describe(a)}
                  {cachedIds.has(t.contentHash) && (
                    <span className="ml-1 text-emerald-600" title="From cache — no re-analysis">
                      ⚡
                    </span>
                  )}
                </span>
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

      {built && (
        <div className="flex flex-col gap-2">
          <BuiltSet set={built} displayById={builtDisplay} name={setName} note={loadNote} />
          {userId && (
            <div className="flex items-center gap-2">
              <input
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                className="rounded bg-neutral-800 px-2 py-1 text-sm outline-none"
                placeholder="Set name"
              />
              <button className={btn.subtle} onClick={() => void saveCurrent()}>
                {currentSetId ? 'Update set' : 'Save set'}
              </button>
            </div>
          )}
        </div>
      )}

      {userId && savedSets.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Saved sets</p>
          <ul className="divide-y divide-neutral-800 rounded border border-neutral-800 text-sm">
            {savedSets.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-1.5">
                <button
                  className="min-w-0 flex-1 truncate text-left hover:text-indigo-300"
                  onClick={() => void openSet(s.id)}
                >
                  {s.name}
                  {s.id === currentSetId && (
                    <span className="ml-2 text-xs text-emerald-500">open</span>
                  )}
                </button>
                <button
                  className={tag.off}
                  onClick={() => {
                    const name = window.prompt('Rename set', s.name)
                    if (name) void renameSetTo(s.id, name)
                  }}
                >
                  rename
                </button>
                <button className={tag.off} onClick={() => void removeSet(s.id)}>
                  delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function BuiltSet({
  set,
  displayById,
  name,
  note,
}: {
  set: SequencedSet
  displayById: Map<string, TrackDisplay>
  name: string
  note?: string | null
}) {
  const exportAs = (kind: 'm3u8' | 'rekordbox' | 'sheet') => {
    const exp = buildSetExport(set, displayById, name)
    const stem = safeFileStem(name)
    if (kind === 'm3u8') downloadText(`${stem}.m3u8`, toM3U8(exp), 'audio/x-mpegurl')
    else if (kind === 'rekordbox')
      downloadText(`${stem}.xml`, toRekordboxXml(exp), 'application/xml')
    else downloadText(`${stem}.md`, toSetSheet(exp), 'text/markdown')
  }

  return (
    <div className="rounded border border-emerald-900 bg-emerald-950/30 p-3">
      {note && <p className="mb-2 text-xs text-amber-400">{note}</p>}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-sm text-neutral-300">
          {ARC_LABELS[set.arc]} set · {set.order.length} tracks · flow{' '}
          {(set.totalScore * 100).toFixed(0)}%
        </p>
        <div className="ml-auto flex gap-1">
          <button className={exportBtn} onClick={() => exportAs('m3u8')}>
            M3U8
          </button>
          <button className={exportBtn} onClick={() => exportAs('rekordbox')}>
            Rekordbox
          </button>
          <button className={exportBtn} onClick={() => exportAs('sheet')}>
            Set sheet
          </button>
        </div>
      </div>
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
                <span className="truncate">{displayById.get(t.id)?.title ?? t.id}</span>
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

const exportBtn = 'rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200 hover:bg-neutral-700'
