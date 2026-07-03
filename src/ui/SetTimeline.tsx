import { useState } from 'react'
import type { SectionLabel, TrackFeatures } from '@/analysis/feature-schema'
import type { SequencedSet, TransitionInfo } from '@/sequencing/sequencer'
import { ARC_LABELS, ARC_PRESETS } from '@/sequencing/arc'
import type { TrackDisplay } from '@/export/build'
import { buildSetExport } from '@/export/build'
import { toM3U8 } from '@/export/m3u8'
import { toRekordboxXml } from '@/export/rekordbox'
import { toSetSheet } from '@/export/setsheet'
import { downloadText, safeFileStem } from '@/export/download'
import { areaPath, linePath, pointsToArea, pointsToLine, scalePoints } from './chart-utils'
import { SECTION_COLORS, camelotColor } from './colors'

// Visual set timeline (plan Chunk 4.2): energy-arc chart + per-track cards
// (energy sparkline, section strip, key/BPM), drag-to-reorder with live
// re-scoring, and a click-to-expand transition inspector (4.3/4.4 slices).

export default function SetTimeline({
  set,
  displayById,
  name,
  note,
  onReorder,
}: {
  set: SequencedSet
  displayById: Map<string, TrackDisplay>
  name: string
  note?: string | null
  onReorder: (from: number, to: number) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [openJunction, setOpenJunction] = useState<number | null>(null)

  const exportAs = (kind: 'm3u8' | 'rekordbox' | 'sheet') => {
    const exp = buildSetExport(set, displayById, name)
    const stem = safeFileStem(name)
    if (kind === 'm3u8') downloadText(`${stem}.m3u8`, toM3U8(exp), 'audio/x-mpegurl')
    else if (kind === 'rekordbox')
      downloadText(`${stem}.xml`, toRekordboxXml(exp), 'application/xml')
    else downloadText(`${stem}.md`, toSetSheet(exp), 'text/markdown')
  }

  const drop = (to: number) => {
    if (dragIndex !== null && dragIndex !== to) onReorder(dragIndex, to)
    setDragIndex(null)
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-800 bg-neutral-900/40 p-3">
      {note && <p className="text-xs text-amber-400">{note}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-neutral-300">
          {ARC_LABELS[set.arc]} · {set.order.length} tracks · flow{' '}
          <span className="text-emerald-400">{(set.totalScore * 100).toFixed(0)}%</span>
        </p>
        <div className="ml-auto flex gap-1">
          {(['m3u8', 'rekordbox', 'sheet'] as const).map((k) => (
            <button key={k} className={exportBtn} onClick={() => exportAs(k)}>
              {k === 'm3u8' ? 'M3U8' : k === 'rekordbox' ? 'Rekordbox' : 'Set sheet'}
            </button>
          ))}
        </div>
      </div>

      <ArcChart set={set} />
      <SectionLegend />

      <ol className="flex flex-col">
        {set.order.map((t, i) => {
          const tr = i > 0 ? set.transitions[i - 1] : null
          return (
            <li key={`${t.id}-${i}`}>
              {tr && (
                <TransitionRow
                  info={tr}
                  open={openJunction === i}
                  onToggle={() => setOpenJunction(openJunction === i ? null : i)}
                />
              )}
              <div
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(i)}
                onDragEnd={() => setDragIndex(null)}
                className={`flex cursor-grab items-center gap-2 rounded px-2 py-1.5 active:cursor-grabbing ${
                  dragIndex === i ? 'opacity-40' : 'hover:bg-neutral-800/60'
                }`}
              >
                <span className="w-5 shrink-0 text-right font-mono text-xs text-neutral-600">
                  {i + 1}
                </span>
                <span className="text-neutral-600">⠿</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {displayById.get(t.id)?.title ?? t.id}
                </span>
                <SectionWaveform track={t.features} />
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 font-mono text-xs text-white"
                  style={{ backgroundColor: camelotColor(t.features.key.camelot) }}
                  title={t.features.key.key}
                >
                  {t.features.key.camelot || '—'}
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-xs text-neutral-400">
                  {t.features.tempo.bpm.toFixed(0)}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ArcChart({ set }: { set: SequencedSet }) {
  const W = 600
  const H = 70
  const actual = set.order.map((t) => t.features.energy.score / 10)
  const preset = ARC_PRESETS[set.arc]
  const target =
    set.order.length > 1
      ? set.order.map((_, i) => preset(i / (set.order.length - 1)).energy)
      : [preset(0.5).energy]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" preserveAspectRatio="none">
      <path d={areaPath(actual, W, H)} fill="rgba(16,185,129,0.15)" />
      <path d={linePath(actual, W, H)} fill="none" stroke="#10b981" strokeWidth={2} />
      <path
        d={linePath(target, W, H)}
        fill="none"
        stroke="#6b7280"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
    </svg>
  )
}

// Energy waveform tinted by section — one visual for both the energy shape and the
// arrangement. Each section's slice of the curve is drawn in its section color, so
// "the loud part is the drop" reads at a glance.
const WF_W = 180
const WF_H = 34

function SectionWaveform({ track }: { track: TrackFeatures }) {
  const curve = track.energy.curve
  const n = curve.length
  if (n === 0) return <span className="shrink-0" style={{ width: WF_W }} />

  const pts = scalePoints(curve, WF_W, WF_H)
  const hop = track.energy.hopSec || track.durationSec / n || 1

  return (
    <svg
      viewBox={`0 0 ${WF_W} ${WF_H}`}
      width={WF_W}
      height={WF_H}
      className="shrink-0"
      preserveAspectRatio="none"
    >
      {track.sections.map((s, i) => {
        const start = Math.min(n - 1, Math.max(0, Math.floor(s.startSec / hop)))
        const end = Math.min(n - 1, Math.max(start, Math.ceil(s.endSec / hop)))
        const sub = pts.slice(start, end + 1) // +1 so adjacent sections join
        const color = SECTION_COLORS[s.label]
        return (
          <g key={i}>
            <path d={pointsToArea(sub, WF_H)} fill={color} fillOpacity={0.3} />
            <path d={pointsToLine(sub)} fill="none" stroke={color} strokeWidth={1.5} />
          </g>
        )
      })}
    </svg>
  )
}

const LEGEND: [SectionLabel, string][] = [
  ['intro', 'Intro'],
  ['build', 'Build'],
  ['drop', 'Drop'],
  ['breakdown', 'Breakdown'],
  ['outro', 'Outro'],
]

function SectionLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
      <span className="text-neutral-600">Waveform color = section:</span>
      {LEGEND.map(([label, name]) => (
        <span key={label} className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-3 rounded-sm"
            style={{ backgroundColor: SECTION_COLORS[label] }}
          />
          {name}
        </span>
      ))}
    </div>
  )
}

function TransitionRow({
  info,
  open,
  onToggle,
}: {
  info: TransitionInfo
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="pl-7">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 py-0.5 text-left text-xs text-neutral-500 hover:text-neutral-300"
      >
        <span className="text-neutral-600">↓</span>
        <span>{(info.score.total * 100).toFixed(0)}%</span>
        {info.warnings.map((w) => (
          <span key={w} className="text-amber-400">
            {w}
          </span>
        ))}
        <span className="ml-auto text-neutral-700">{open ? 'hide' : 'details'}</span>
      </button>
      {open && (
        <div className="mb-1 ml-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-neutral-400">
          {info.score.terms
            .filter((term) => term.available)
            .map((term) => (
              <div key={term.term} className="contents">
                <span className="text-neutral-500">{Math.round(term.score * 100)}%</span>
                <span>{term.note}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

const exportBtn = 'rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200 hover:bg-neutral-700'
