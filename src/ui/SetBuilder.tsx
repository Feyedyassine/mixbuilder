import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  type TransitionInfo,
} from '@/sequencing/sequencer'
import { computeFits, type TrackFit } from '@/sequencing/fit'
import { ARC_LABELS, type ArcName } from '@/sequencing/arc'
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
import { buildSetExport, type TrackDisplay } from '@/export/build'
import { toM3U8 } from '@/export/m3u8'
import { toRekordboxXml } from '@/export/rekordbox'
import { toSetSheet } from '@/export/setsheet'
import { downloadText, safeFileStem } from '@/export/download'
import ArcPicker from '@/ui/ArcPicker'
import HowItWorks from '@/ui/HowItWorks'
import { ArcChart, SectionLegend, SectionWaveform } from '@/ui/track-visuals'
import { playJunction, type PreviewHandle } from '@/ui/junction-preview'
import { camelotColor, camelotColorMuted } from '@/ui/colors'

type Analysis = TrackFeatures | 'analyzing' | { error: true }

export default function SetBuilder({
  onContentChange,
}: {
  onContentChange?: (hasContent: boolean) => void
}) {
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
  const [menuId, setMenuId] = useState<string | null>(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [openJunction, setOpenJunction] = useState<number | null>(null)
  const previewRef = useRef<PreviewHandle | null>(null)
  const { session } = useSession()
  const userId = session?.user.id

  useEffect(() => disposeAnalysisPool, [])
  useEffect(() => () => previewRef.current?.stop(), [])

  // Tell the shell whether we're past the empty landing (moves the wordmark to
  // the header). setState-in-effect is intentional here — it syncs a layout flag.
  useEffect(() => {
    onContentChange?.(tracks.length > 0 || built !== null)
  }, [tracks.length, built, onContentChange])

  const refreshSaved = useCallback(async () => {
    const sets = await (userId ? listSets() : Promise.resolve<SetSummary[]>([]))
    setSavedSets(sets)
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSaved()
  }, [refreshSaved])

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
    setCurrentSetId(null)
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
    setSavedOpen(false)
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

  const previewJunction = (info: TransitionInfo) => {
    previewRef.current?.stop()
    const from = tracks.find((t) => t.contentHash === info.fromId)?.file
    const to = tracks.find((t) => t.contentHash === info.toId)?.file
    if (!from || !to) return
    previewRef.current = playJunction(
      from,
      info.mixPoint.fromStartSec,
      to,
      info.mixPoint.toStartSec,
    )
  }

  const displayById = new Map<string, TrackDisplay>()
  for (const t of tracks) {
    displayById.set(t.contentHash, {
      fileName: t.name,
      title: t.tags.title ?? t.name,
      artist: t.tags.artist,
    })
  }
  const coverFor = (hash: string) => tracks.find((t) => t.contentHash === hash)?.tags.cover

  const exportAs = (kind: 'm3u8' | 'rekordbox' | 'sheet') => {
    if (!built) return
    const exp = buildSetExport(built, builtDisplay, setName)
    const stem = safeFileStem(setName)
    if (kind === 'm3u8') downloadText(`${stem}.m3u8`, toM3U8(exp), 'audio/x-mpegurl')
    else if (kind === 'rekordbox')
      downloadText(`${stem}.xml`, toRekordboxXml(exp), 'application/xml')
    else downloadText(`${stem}.md`, toSetSheet(exp), 'text/markdown')
    setExportOpen(false)
  }

  const dropOn = (to: number) => {
    if (dragIndex !== null && dragIndex !== to) reorderBuilt(dragIndex, to)
    setDragIndex(null)
  }

  const status = progress
    ? `reading ${progress.done}/${progress.total}`
    : analyzeProgress
      ? `analyzing ${analyzeProgress.done}/${analyzeProgress.total}`
      : null

  if (tracks.length === 0 && !built) {
    return (
      <Hero
        onAdd={() => void addTracks(pickAudioFiles)}
        onAddFolder={
          isDirectoryPickerSupported() ? () => void addTracks(pickAudioDirectory) : undefined
        }
        busy={busy}
        status={status}
      />
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* ── Console ─────────────────────────────────────────────── */}
      <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={ui.ghost}
            onClick={() => void addTracks(pickAudioFiles)}
            disabled={busy}
          >
            + Add tracks
          </button>
          {isDirectoryPickerSupported() && (
            <button
              className={ui.ghost}
              onClick={() => void addTracks(pickAudioDirectory)}
              disabled={busy}
            >
              Folder
            </button>
          )}
          {(progress || analyzeProgress) && (
            <span
              className={`font-mono text-xs ${
                analyzeProgress && !progress ? 'animate-pulse text-purple-400' : 'text-signal-500'
              }`}
            >
              {progress
                ? `reading ${progress.done}/${progress.total}`
                : `analyzing ${analyzeProgress!.done}/${analyzeProgress!.total}`}
            </span>
          )}
          {userId && savedSets.length > 0 && (
            <div className="relative ml-auto">
              <button className={ui.ghost} onClick={() => setSavedOpen((v) => !v)}>
                Sets ▾
              </button>
              {savedOpen && (
                <Popover onClose={() => setSavedOpen(false)} width="w-64">
                  {savedSets.map((s) => (
                    <div key={s.id} className="flex items-center gap-1">
                      <button
                        className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-800"
                        onClick={() => void openSet(s.id)}
                      >
                        {s.name}
                        {s.id === currentSetId && <span className="ml-1 text-signal-500">•</span>}
                      </button>
                      <button
                        className="rounded px-1.5 py-1 text-xs text-neutral-500 hover:text-neutral-200"
                        onClick={() => {
                          const name = window.prompt('Rename set', s.name)
                          if (name) void renameSetTo(s.id, name)
                        }}
                      >
                        ✎
                      </button>
                      <button
                        className="rounded px-1.5 py-1 text-xs text-neutral-500 hover:text-red-400"
                        onClick={() => void removeSet(s.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </Popover>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <ArcPicker value={arc} onChange={setArc} />
          </div>
          <button
            className={ui.build}
            onClick={buildSet}
            disabled={busy || active.length < 2}
            title={active.length < 2 ? 'Add at least 2 analyzed tracks' : undefined}
          >
            {built ? 'Rebuild' : 'Build set'}
            <span className="ml-1.5 font-mono text-xs opacity-70">{active.length}</span>
          </button>
        </div>
      </div>

      {/* ── Set header (arc band) ───────────────────────────────── */}
      {built && (
        <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          {loadNote && <p className="mb-2 text-xs text-signal-500">{loadNote}</p>}
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-lg tabular-nums text-signal-500">
              {(built.totalScore * 100).toFixed(0)}%
            </span>
            <span className="text-sm text-neutral-400">
              flow · {ARC_LABELS[built.arc]} · {built.order.length} tracks
            </span>
            <div className="ml-auto flex items-center gap-2">
              {userId && (
                <>
                  <input
                    value={setName}
                    onChange={(e) => setSetName(e.target.value)}
                    className="w-28 rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm outline-none focus:border-neutral-600"
                    placeholder="Set name"
                  />
                  <button className={ui.ghost} onClick={() => void saveCurrent()}>
                    {currentSetId ? 'Update' : 'Save'}
                  </button>
                </>
              )}
              <div className="relative">
                <button className={ui.ghost} onClick={() => setExportOpen((v) => !v)}>
                  Export ▾
                </button>
                {exportOpen && (
                  <Popover onClose={() => setExportOpen(false)} width="w-40">
                    <MenuItem onClick={() => exportAs('m3u8')}>M3U8 playlist</MenuItem>
                    <MenuItem onClick={() => exportAs('rekordbox')}>Rekordbox XML</MenuItem>
                    <MenuItem onClick={() => exportAs('sheet')}>Set sheet</MenuItem>
                  </Popover>
                )}
              </div>
            </div>
          </div>
          <ArcChart
            energies={built.order.map((t) => t.features.energy.score / 10)}
            arc={built.arc}
          />
          <SectionLegend />
        </div>
      )}

      {/* ── Unified track list ──────────────────────────────────── */}
      {built ? (
        <ol className="overflow-hidden rounded-xl border border-neutral-800">
          {built.order.map((t, i) => {
            const tr = i > 0 ? built.transitions[i - 1] : null
            const disp = builtDisplay.get(t.id)
            return (
              <li key={`${t.id}-${i}`} className="border-t border-neutral-800/60 first:border-t-0">
                {tr && (
                  <TransitionConnector
                    info={tr}
                    open={openJunction === i}
                    onToggle={() => setOpenJunction(openJunction === i ? null : i)}
                    canPreview={
                      tracks.some((x) => x.contentHash === tr.fromId) &&
                      tracks.some((x) => x.contentHash === tr.toId)
                    }
                    onPreview={() => previewJunction(tr)}
                  />
                )}
                <div
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(i)}
                  onDragEnd={() => setDragIndex(null)}
                  className={`group flex cursor-grab items-center gap-3 px-3 py-2 transition-colors active:cursor-grabbing ${
                    dragIndex === i ? 'opacity-40' : 'hover:bg-neutral-900/50'
                  }`}
                >
                  <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-neutral-600">
                    {i + 1}
                  </span>
                  <span className="shrink-0 text-neutral-700 group-hover:text-neutral-500">⠿</span>
                  <TrackCore
                    cover={coverFor(t.id)}
                    title={disp?.title ?? t.id}
                    artist={disp?.artist}
                    features={t.features}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        tracks.length > 0 && (
          <ol className="overflow-hidden rounded-xl border border-neutral-800">
            {tracks.map((t) => {
              const a = analyses[t.contentHash]
              const fit = fitsById.get(t.contentHash)
              const isBenched = benched.has(t.contentHash)
              const feats = isFeatures(a) ? a : undefined
              return (
                <li
                  key={t.contentHash}
                  className={`border-t border-neutral-800/60 first:border-t-0 ${isBenched ? 'opacity-45' : ''}`}
                >
                  <div className="group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-neutral-900/50">
                    <TrackCore
                      cover={t.tags.cover}
                      title={t.tags.title ?? t.name}
                      artist={t.tags.artist}
                      features={feats}
                      misfit={fit?.isMisfit ? fit.reasons.join('; ') : undefined}
                    />
                    {!feats &&
                      (a === 'analyzing' ? (
                        <span className="shrink-0 animate-pulse font-mono text-xs text-purple-400">
                          analyzing…
                        </span>
                      ) : (
                        <span className="shrink-0 font-mono text-xs text-neutral-500">
                          {a && 'error' in a ? 'failed' : '…'}
                        </span>
                      ))}
                    {feats && cachedIds.has(t.contentHash) && (
                      <span className="shrink-0 text-emerald-500" title="From cache">
                        ⚡
                      </span>
                    )}
                    {anchors.start === t.contentHash && <Pill>1st</Pill>}
                    {anchors.end === t.contentHash && <Pill>last</Pill>}
                    <div className="relative shrink-0">
                      <button
                        className="rounded px-1.5 py-1 text-neutral-500 opacity-60 transition hover:bg-neutral-800 hover:text-neutral-200 group-hover:opacity-100"
                        onClick={() => setMenuId(menuId === t.contentHash ? null : t.contentHash)}
                      >
                        ⋯
                      </button>
                      {menuId === t.contentHash && (
                        <Popover onClose={() => setMenuId(null)} width="w-40">
                          <MenuItem
                            onClick={() => {
                              toggleAnchor('start', t.contentHash)
                              setMenuId(null)
                            }}
                          >
                            {anchors.start === t.contentHash ? '✓ ' : ''}Pin as first
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              toggleAnchor('end', t.contentHash)
                              setMenuId(null)
                            }}
                          >
                            {anchors.end === t.contentHash ? '✓ ' : ''}Pin as last
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              toggleBench(t.contentHash)
                              setMenuId(null)
                            }}
                          >
                            {isBenched ? 'Restore to set' : 'Bench'}
                          </MenuItem>
                          {feats && (
                            <MenuItem
                              onClick={() => {
                                setEditingId(t.contentHash)
                                setMenuId(null)
                              }}
                            >
                              Correct BPM / key
                            </MenuItem>
                          )}
                        </Popover>
                      )}
                    </div>
                  </div>
                  {editingId === t.contentHash && feats && (
                    <OverrideEditor
                      bpm={feats.tempo.bpm}
                      camelot={feats.key.camelot}
                      onSave={(b, k) => void applyTrackOverride(t, b, k)}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        )
      )}
    </div>
  )
}

// ── empty-state hero (collapses to the header once tracks are added) ─────────
function Hero({
  onAdd,
  onAddFolder,
  busy,
  status,
}: {
  onAdd: () => void
  onAddFolder?: () => void
  busy: boolean
  status: string | null
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 py-16 sm:py-24">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-neutral-100 sm:text-6xl">
          mix<span className="text-signal-500">builder</span>
        </h1>
        <p className="text-neutral-400">Turn your crate into a set that flows.</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="rounded-lg bg-signal-500 px-5 py-2.5 font-semibold text-neutral-950 transition hover:bg-signal-400 disabled:opacity-40"
          onClick={onAdd}
          disabled={busy}
        >
          Add tracks
        </button>
        {onAddFolder && (
          <button
            className="rounded-lg border border-neutral-700 px-5 py-2.5 font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-neutral-100 disabled:opacity-40"
            onClick={onAddFolder}
            disabled={busy}
          >
            Add folder
          </button>
        )}
      </div>
      <div
        className={`h-4 font-mono text-xs ${
          status?.startsWith('analyzing') ? 'animate-pulse text-purple-400' : 'text-signal-500'
        }`}
      >
        {status}
      </div>
      <div className="w-full">
        <HowItWorks />
      </div>
    </div>
  )
}

// ── shared visual core ───────────────────────────────────────────────────────
function TrackCore({
  cover,
  title,
  artist,
  features,
  misfit,
}: {
  cover?: string
  title: string
  artist?: string
  features?: TrackFeatures
  misfit?: string
}) {
  return (
    <>
      <TrackCover cover={cover} camelot={features?.key.camelot ?? ''} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm text-neutral-100">{title}</span>
          {misfit && (
            <span className="shrink-0 text-signal-500" title={misfit}>
              ▲
            </span>
          )}
        </div>
        {artist && <div className="truncate text-xs text-neutral-500">{artist}</div>}
      </div>
      {features && (
        <>
          <div className="hidden sm:block">
            <SectionWaveform track={features} width={150} height={28} />
          </div>
          <KeyChip camelot={features.key.camelot} musicalKey={features.key.key} />
          <span className="w-11 shrink-0 text-right font-mono text-sm tabular-nums text-neutral-300">
            {features.tempo.bpm.toFixed(0)}
            <span className="ml-0.5 text-[9px] text-neutral-600">bpm</span>
          </span>
        </>
      )}
    </>
  )
}

function KeyChip({ camelot, musicalKey }: { camelot: string; musicalKey?: string }) {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums"
      style={{
        backgroundColor: camelotColorMuted(camelot),
        color: camelot ? camelotColor(camelot) : '#9ca3af',
      }}
      title={musicalKey}
    >
      {camelot || '—'}
    </span>
  )
}

function isFeatures(a: Analysis | undefined): a is TrackFeatures {
  return !!a && a !== 'analyzing' && !('error' in a)
}

function TrackCover({ cover, camelot }: { cover?: string; camelot: string }) {
  if (cover) {
    return <img src={cover} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
  }
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-sm text-neutral-400"
      style={{ backgroundColor: camelotColorMuted(camelot) }}
      aria-hidden
    >
      ♪
    </span>
  )
}

function TransitionConnector({
  info,
  open,
  onToggle,
  canPreview,
  onPreview,
}: {
  info: TransitionInfo
  open: boolean
  onToggle: () => void
  canPreview: boolean
  onPreview: () => void
}) {
  const pct = Math.round(info.score.total * 100)
  const color =
    info.score.total >= 0.75 ? '#34d399' : info.score.total >= 0.5 ? '#f5a623' : '#f87171'
  return (
    <div className="bg-neutral-950/40">
      <div className="flex items-center gap-2 px-3 py-1 pl-10 text-xs text-neutral-500">
        <span className="text-neutral-700">↓</span>
        <span className="font-mono tabular-nums" style={{ color }}>
          {pct}%
        </span>
        {info.warnings.map((w) => (
          <span
            key={w}
            className="rounded bg-signal-500/10 px-1.5 py-0.5 text-[11px] text-signal-500"
          >
            {w}
          </span>
        ))}
        {canPreview && !open && (
          <button
            onClick={onPreview}
            className="text-neutral-500 hover:text-neutral-200"
            title="Hear the outro → intro blend"
          >
            ▶
          </button>
        )}
        <button onClick={onToggle} className="ml-auto text-neutral-600 hover:text-neutral-300">
          {open ? 'hide' : 'details'}
        </button>
      </div>
      {open && (
        <div className="flex items-center gap-4 px-3 pb-3 pl-10">
          <div className="grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-neutral-400">
            {info.score.terms
              .filter((term) => term.available)
              .map((term) => (
                <div key={term.term} className="contents">
                  <span className="font-mono tabular-nums text-neutral-500">
                    {Math.round(term.score * 100)}%
                  </span>
                  <span>{term.note}</span>
                </div>
              ))}
          </div>
          {canPreview && (
            <button
              onClick={onPreview}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-signal-500 text-neutral-950 shadow-lg transition hover:scale-105 hover:bg-signal-400"
              title="Hear the outro → intro blend"
              aria-label="Preview transition"
            >
              <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
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
  const field =
    'w-16 rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs outline-none focus:border-neutral-600'
  return (
    <div className="flex items-center gap-2 border-t border-neutral-800/60 bg-neutral-950/60 px-3 py-2 text-xs">
      <span className="text-neutral-500">Correct</span>
      <input value={b} onChange={(e) => setB(e.target.value)} className={field} aria-label="BPM" />
      <input value={k} onChange={(e) => setK(e.target.value)} className={field} aria-label="Key" />
      <button
        className="rounded bg-signal-500 px-2 py-1 font-medium text-neutral-950 hover:bg-signal-400"
        onClick={() => onSave(b, k)}
      >
        Save
      </button>
      <button
        className="rounded px-2 py-1 text-neutral-400 hover:text-neutral-100"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  )
}

// ── little primitives ────────────────────────────────────────────────────────
function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded bg-signal-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-signal-500">
      {children}
    </span>
  )
}

function Popover({
  onClose,
  width,
  children,
}: {
  onClose: () => void
  width: string
  children: ReactNode
}) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div
        className={`absolute right-0 z-30 mt-1 ${width} rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-xl`}
      >
        {children}
      </div>
    </>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-800"
    >
      {children}
    </button>
  )
}

const ui = {
  ghost:
    'rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40',
  build:
    'rounded-lg bg-signal-500 px-4 py-1.5 text-sm font-semibold text-neutral-950 transition hover:bg-signal-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500',
}
