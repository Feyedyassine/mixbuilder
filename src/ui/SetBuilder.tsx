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
import type { ArcName } from '@/sequencing/arc'
import { localGet } from '@/storage/idb-cache'
import { communityGet } from '@/storage/community-cache'
import { setOverride } from '@/storage/overrides'
import { applyOverride } from '@/storage/feature-resolver'
import {
  deleteSet,
  listSets,
  loadSet,
  renameSet,
  saveSet,
  serializeSet,
  type SetSummary,
} from '@/storage/sets-store'
import type { TrackDisplay } from '@/export/build'
import SetTimeline from '@/ui/SetTimeline'
import ArcPicker from '@/ui/ArcPicker'
import HowItWorks from '@/ui/HowItWorks'
import { camelotColorMuted } from '@/ui/colors'

type Analysis = TrackFeatures | 'analyzing' | { error: true }

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
  const [editingId, setEditingId] = useState<string | null>(null)
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

  // Analyze a batch, up to pool-size at once: saturates the workers without
  // holding every decoded track in memory simultaneously.
  const analyzePending = async (list: TrackFile[]) => {
    const pending = list.filter((t) => !isFeatures(analyses[t.contentHash]))
    if (pending.length === 0) return
    let done = 0
    setAnalyzeProgress({ done, total: pending.length })
    try {
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
    }
  }

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
      setProgress(null)
      // Auto-analyze newly added tracks — no separate button.
      await analyzePending(ingested)
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

  const reorderBuilt = (from: number, to: number) => {
    if (!built) return
    const order = [...built.order]
    const [moved] = order.splice(from, 1)
    if (!moved) return
    order.splice(to, 0, moved)
    setBuilt(sequenceInOrder(order, { arc: built.arc }))
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

  // Manual BPM/key correction. Prefilled with current values, so both persist and
  // an unchanged field keeps its value (avoids clobbering a prior override).
  const applyTrackOverride = async (track: TrackFile, bpmStr: string, camelotStr: string) => {
    const current = analyses[track.contentHash]
    if (!isFeatures(current)) return
    let bpm = bpmStr.trim() ? Number(bpmStr) : current.tempo.bpm
    if (!Number.isFinite(bpm)) bpm = current.tempo.bpm
    const override = { bpm, camelot: camelotStr.trim() || current.key.camelot }
    setAnalyses((p) => ({ ...p, [track.contentHash]: applyOverride(current, override) }))
    setEditingId(null)
    if (userId) {
      await setOverride(userId, track.contentHash, override, {
        title: track.tags.title,
        artist: track.tags.artist,
      }).catch(() => {})
    }
  }

  const displayById = new Map<string, TrackDisplay>()
  for (const t of tracks) {
    displayById.set(t.contentHash, {
      fileName: t.name,
      title: t.tags.title ?? t.name,
      artist: t.tags.artist,
    })
  }

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6">
      {tracks.length === 0 && !built && <HowItWorks />}
      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Library ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
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
            {(progress || analyzeProgress) && (
              <span className="text-sm text-neutral-500">
                {progress
                  ? `Reading ${progress.done}/${progress.total}…`
                  : `Analyzing ${analyzeProgress!.done}/${analyzeProgress!.total}…`}
              </span>
            )}
          </div>

          {tracks.length === 0 ? (
            <p className="rounded border border-dashed border-neutral-800 px-3 py-8 text-center text-sm text-neutral-600">
              Add tracks to analyze — they stay on your device.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-800 rounded border border-neutral-800 text-sm">
              {tracks.map((t) => {
                const a = analyses[t.contentHash]
                const fit = fitsById.get(t.contentHash)
                const isBenched = benched.has(t.contentHash)
                return (
                  <li
                    key={t.contentHash}
                    className={`flex flex-col ${isBenched ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-3 px-3 py-1.5">
                      <TrackCover
                        cover={t.tags.cover}
                        camelot={isFeatures(a) ? a.key.camelot : ''}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {t.tags.title ?? t.name}
                        {t.tags.artist && (
                          <span className="text-neutral-500"> — {t.tags.artist}</span>
                        )}
                        {fit?.isMisfit && (
                          <span className="ml-2 text-amber-400" title={fit.reasons.join('; ')}>
                            ⚠ misfit
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-neutral-400">
                        {describe(a)}
                        {cachedIds.has(t.contentHash) && (
                          <span
                            className="ml-1 text-emerald-600"
                            title="From cache — no re-analysis"
                          >
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
                        {isFeatures(a) && (
                          <button
                            className={tag.off}
                            onClick={() =>
                              setEditingId(editingId === t.contentHash ? null : t.contentHash)
                            }
                            title="Correct BPM/key"
                          >
                            edit
                          </button>
                        )}
                      </span>
                    </div>
                    {editingId === t.contentHash && isFeatures(a) && (
                      <OverrideEditor
                        bpm={a.tempo.bpm}
                        camelot={a.key.camelot}
                        onSave={(b, k) => void applyTrackOverride(t, b, k)}
                        onCancel={() => setEditingId(null)}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ── Set ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <ArcPicker value={arc} onChange={setArc} />
          <button
            className={`${btn.build} w-full`}
            onClick={buildSet}
            disabled={busy || active.length < 2}
          >
            Build set ({active.length} tracks)
          </button>

          {built && (
            <div className="flex flex-col gap-2">
              <SetTimeline
                set={built}
                displayById={builtDisplay}
                name={setName}
                note={loadNote}
                onReorder={reorderBuilt}
                getFile={(hash) => tracks.find((t) => t.contentHash === hash)?.file}
              />
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
      </div>
    </div>
  )
}

function isFeatures(a: Analysis | undefined): a is TrackFeatures {
  return !!a && a !== 'analyzing' && !('error' in a)
}

// Embedded cover art when present; otherwise a tile tinted by the track's key so
// art-less files (e.g. some rips) still look intentional rather than broken.
function TrackCover({ cover, camelot }: { cover?: string; camelot: string }) {
  if (cover) {
    return <img src={cover} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
  }
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-sm text-neutral-400"
      style={{ backgroundColor: camelotColorMuted(camelot) }}
      aria-hidden
    >
      ♪
    </span>
  )
}

function OverrideEditor({
  bpm,
  camelot,
  onSave,
  onCancel,
}: {
  bpm: number
  camelot: string
  onSave: (bpm: string, camelot: string) => void
  onCancel: () => void
}) {
  const [b, setB] = useState(String(Math.round(bpm)))
  const [k, setK] = useState(camelot)
  return (
    <div className="flex items-center gap-2 bg-neutral-900/60 px-3 py-1.5 text-xs">
      <span className="text-neutral-500">Correct</span>
      <input
        value={b}
        onChange={(e) => setB(e.target.value)}
        className="w-14 rounded bg-neutral-800 px-2 py-0.5 outline-none"
        placeholder="BPM"
        aria-label="BPM"
      />
      <input
        value={k}
        onChange={(e) => setK(e.target.value)}
        className="w-14 rounded bg-neutral-800 px-2 py-0.5 outline-none"
        placeholder="8A"
        aria-label="Key (Camelot)"
      />
      <button
        className="rounded bg-indigo-600 px-2 py-0.5 text-white hover:bg-indigo-500"
        onClick={() => onSave(b, k)}
      >
        Save
      </button>
      <button
        className="rounded bg-neutral-800 px-2 py-0.5 hover:bg-neutral-700"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  )
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
}

const tag = {
  off: 'rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-700',
  on: 'rounded bg-indigo-600 px-1.5 py-0.5 text-xs text-white',
}
