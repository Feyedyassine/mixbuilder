import type { SectionLabel, TrackFeatures } from '@/analysis/feature-schema'
import { ARC_PRESETS, type ArcName } from '@/sequencing/arc'
import { areaPath, linePath, pointsToArea, pointsToLine, scalePoints } from './chart-utils'
import { SECTION_COLORS } from './colors'

// Shared visual atoms for the unified track canvas.

/** Energy waveform tinted by section — one visual for energy shape + arrangement. */
export function SectionWaveform({
  track,
  width = 220,
  height = 34,
}: {
  track: TrackFeatures
  width?: number
  height?: number
}) {
  const curve = track.energy.curve
  const n = curve.length
  if (n === 0) return <span className="shrink-0" style={{ width, height }} />

  const pts = scalePoints(curve, width, height)
  const hop = track.energy.hopSec || track.durationSec / n || 1

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="shrink-0"
      preserveAspectRatio="none"
    >
      {track.sections.map((s, i) => {
        const start = Math.min(n - 1, Math.max(0, Math.floor(s.startSec / hop)))
        const end = Math.min(n - 1, Math.max(start, Math.ceil(s.endSec / hop)))
        const sub = pts.slice(start, end + 1)
        const color = SECTION_COLORS[s.label]
        return (
          <g key={i}>
            <path d={pointsToArea(sub, height)} fill={color} fillOpacity={0.28} />
            <path d={pointsToLine(sub)} fill="none" stroke={color} strokeWidth={1.5} />
          </g>
        )
      })}
    </svg>
  )
}

/** Whole-set energy line (actual, filled) over the target arc (dashed). */
export function ArcChart({
  energies,
  arc,
  className = 'h-14 w-full',
}: {
  energies: number[]
  arc: ArcName
  className?: string
}) {
  const W = 800
  const H = 80
  const preset = ARC_PRESETS[arc]
  const target =
    energies.length > 1
      ? energies.map((_, i) => preset(i / (energies.length - 1)).energy)
      : [preset(0.5).energy]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none">
      <path d={areaPath(energies, W, H)} fill="rgba(245,166,35,0.10)" />
      <path
        d={linePath(target, W, H)}
        fill="none"
        stroke="#4b5563"
        strokeWidth={1.5}
        strokeDasharray="6 5"
      />
      <path d={linePath(energies, W, H)} fill="none" stroke="#f5a623" strokeWidth={2} />
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

export function SectionLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
      {LEGEND.map(([label, name]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-3 rounded-full"
            style={{ backgroundColor: SECTION_COLORS[label] }}
          />
          {name}
        </span>
      ))}
    </div>
  )
}
