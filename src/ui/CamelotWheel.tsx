import type { KeyboardEvent } from 'react'
import { CAMELOT_KEYS, WHEEL_NUMBERS, type Move } from '@/tools/camelot'
import { camelotHue } from '@/ui/colors'

// The wheel, drawn like a record under club lights: 24 key segments in their
// wheel hues (outer ring B/major, inner ring A/minor) around a grooved label that
// shows the selected key. Compatible keys light up with their move tag; the rest
// fade back. Every segment is a button (click, Enter, Space).

const SIZE = 480
const C = SIZE / 2
const RINGS = {
  B: { inner: 168, outer: 228, code: 17, tag: 10 },
  A: { inner: 106, outer: 164, code: 15, tag: 9.5 },
} as const
const HUB = 100
const GAP_DEG = 1.1

type SegState = 'selected' | 'safe' | 'energy' | 'idle' | 'dimmed'

function polar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)]
}

function sector(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r1, a0)
  const [x1, y1] = polar(r1, a1)
  const [x2, y2] = polar(r0, a1)
  const [x3, y3] = polar(r0, a0)
  return `M${x0},${y0} A${r1},${r1} 0 0 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0 0 ${x3},${y3} Z`
}

const FILL: Record<SegState, (h: number) => string> = {
  selected: (h) => `hsl(${h} 78% 58%)`,
  safe: (h) => `hsl(${h} 62% 40%)`,
  energy: (h) => `hsl(${h} 45% 28%)`,
  idle: (h) => `hsl(${h} 45% 22%)`,
  dimmed: (h) => `hsl(${h} 18% 10%)`,
}
const TEXT: Record<SegState, (h: number) => string> = {
  selected: () => '#0b0b0c',
  safe: () => '#ffffff',
  energy: (h) => `hsl(${h} 70% 86%)`,
  idle: (h) => `hsl(${h} 70% 78%)`,
  dimmed: (h) => `hsl(${h} 20% 38%)`,
}

export default function CamelotWheel({
  selected,
  moves,
  highlight,
  onSelect,
}: {
  selected: string | null
  /** Compatible moves from `selected`, keyed by target code. */
  moves: Map<string, Move>
  /** A key to emphasise (e.g. while hovering its row in the moves list). */
  highlight: string | null
  onSelect: (code: string) => void
}) {
  const hue = selected ? (camelotHue(selected) ?? 0) : 30
  const name = selected ? CAMELOT_KEYS[selected] : undefined

  const stateOf = (code: string): SegState => {
    if (!selected) return 'idle'
    if (code === selected) return 'selected'
    const move = moves.get(code)
    if (move) return move.group
    return 'dimmed'
  }

  const segments = (['B', 'A'] as const).flatMap((letter) =>
    WHEEL_NUMBERS.map((n) => ({ code: `${n}${letter}`, n, letter })),
  )
  // Draw the selected segment last so its glow sits above its neighbours.
  const ordered = [...segments].sort(
    (a, b) => Number(a.code === selected) - Number(b.code === selected),
  )

  const onKey = (code: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(code)
    }
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="camelot-wheel h-auto w-full select-none"
      role="group"
      aria-label="Camelot wheel"
    >
      <defs>
        <filter id="wheel-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="wheel-label" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#1c1c20" />
          <stop offset="100%" stopColor="#09090b" />
        </radialGradient>
      </defs>

      {/* Outer tick ring, like a platter's strobe dots. */}
      {Array.from({ length: 120 }, (_, i) => {
        const major = i % 10 === 0
        const [x0, y0] = polar(major ? 232 : 234, i * 3)
        const [x1, y1] = polar(238, i * 3)
        return (
          <line
            key={i}
            x1={x0}
            y1={y0}
            x2={x1}
            y2={y1}
            stroke={major ? 'rgba(245,166,35,0.55)' : 'rgba(255,255,255,0.12)'}
            strokeWidth={major ? 1.6 : 1}
          />
        )
      })}

      {ordered.map(({ code, n, letter }) => {
        const ring = RINGS[letter]
        const h = camelotHue(code) ?? 0
        const state = stateOf(code)
        const move = state !== 'selected' ? moves.get(code) : undefined
        const emphasised = highlight === code
        const angle = n * 30
        const mid = (ring.inner + ring.outer) / 2
        // Stack code over tag in screen space (not along the radius), so they never
        // collide on the left/right of the wheel.
        const [x, y] = polar(mid, angle)
        const [cx, cy] = [x, move ? y - 6 : y]
        const [tx, ty] = [x, y + 11]
        const index = WHEEL_NUMBERS.indexOf(n) + (letter === 'A' ? 12 : 0)
        return (
          <g
            key={code}
            className="wheel-seg"
            style={{ animationDelay: `${index * 22}ms` }}
            role="button"
            tabIndex={0}
            aria-label={`${code}, ${CAMELOT_KEYS[code]!.name}`}
            aria-pressed={state === 'selected'}
            onClick={() => onSelect(code)}
            onKeyDown={onKey(code)}
          >
            <path
              d={sector(ring.inner, ring.outer, angle - 15 + GAP_DEG, angle + 15 - GAP_DEG)}
              fill={FILL[emphasised && state !== 'selected' ? 'safe' : state](h)}
              stroke={state === 'safe' || emphasised ? `hsl(${h} 85% 70% / 0.55)` : 'transparent'}
              strokeWidth={1.2}
              filter={state === 'selected' ? 'url(#wheel-glow)' : undefined}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={ring.code}
              fontWeight={700}
              fill={TEXT[state](h)}
            >
              {code}
            </text>
            {move && (
              <text
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={ring.tag}
                fontWeight={600}
                fill={TEXT[state](h)}
                opacity={0.85}
              >
                {move.tag}
              </text>
            )}
          </g>
        )
      })}

      {/* Record label: grooves, a hue ring and the selected key. */}
      <circle cx={C} cy={C} r={HUB} fill="url(#wheel-label)" />
      {Array.from({ length: 14 }, (_, i) => (
        <circle
          key={i}
          cx={C}
          cy={C}
          r={HUB - 6 - i * 4.5}
          fill="none"
          stroke="rgba(255,255,255,0.035)"
        />
      ))}
      <circle
        cx={C}
        cy={C}
        r={HUB - 1}
        fill="none"
        stroke={selected ? `hsl(${hue} 80% 60%)` : 'rgba(245,166,35,0.5)'}
        strokeWidth={1.5}
        className="wheel-hub-ring"
      />
      {name ? (
        <>
          <text
            x={C}
            y={C - 14}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={46}
            fontWeight={800}
            fill={`hsl(${hue} 85% 66%)`}
          >
            {selected}
          </text>
          <text
            x={C}
            y={C + 22}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={15}
            fill="#e5e5e5"
          >
            {name.name}
          </text>
          {name.alt && (
            <text
              x={C}
              y={C + 42}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fill="#737373"
            >
              also {name.alt}
            </text>
          )}
        </>
      ) : (
        <text
          x={C}
          y={C}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={15}
          fill="#a3a3a3"
        >
          Pick a key
        </text>
      )}
    </svg>
  )
}
