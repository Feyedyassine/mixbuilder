import { ARC_LABELS, ARC_PRESETS, type ArcName } from '@/sequencing/arc'
import { linePath } from './chart-utils'

// Arc presets shown as their actual energy shapes rather than plain labels, so
// the DJ picks by the curve they want the night to follow.

const ARCS: ArcName[] = ['warmup', 'peak', 'journey', 'flat']
const SAMPLES = 24

export default function ArcPicker({
  value,
  onChange,
}: {
  value: ArcName
  onChange: (arc: ArcName) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ARCS.map((a) => {
        const preset = ARC_PRESETS[a]
        const curve = Array.from({ length: SAMPLES }, (_, i) => preset(i / (SAMPLES - 1)).energy)
        const selected = a === value
        return (
          <button
            key={a}
            onClick={() => onChange(a)}
            className={`flex flex-col items-center gap-1 rounded border p-2 transition-colors ${
              selected
                ? 'border-indigo-500 bg-indigo-950/40'
                : 'border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none">
              <path
                d={linePath(curve, 100, 30)}
                fill="none"
                stroke={selected ? '#818cf8' : '#6b7280'}
                strokeWidth={2}
              />
            </svg>
            <span className={`text-xs ${selected ? 'text-indigo-300' : 'text-neutral-400'}`}>
              {ARC_LABELS[a]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
