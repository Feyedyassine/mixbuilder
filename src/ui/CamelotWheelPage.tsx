import { useMemo, useState } from 'react'
import {
  CAMELOT_KEYS,
  WHEEL_NUMBERS,
  compatibleMoves,
  isCamelotCode,
  type Move,
} from '@/tools/camelot'
import { camelotHue } from '@/ui/colors'
import CamelotWheel from '@/ui/CamelotWheel'
import { FINDER_PATH, linkHandler } from '@/lib/navigate'
import { trackEvent } from '@/lib/analytics'

// /tools/camelot-wheel — one job: "what mixes with this key?". Pick a key on the
// wheel (or in the chart); compatible keys light up with what each move does.
// The selection lives in ?key= so a specific key can be linked. Keep in sync with
// the prerendered copy in tools/camelot-wheel.html.

function initialKey(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('key')?.toUpperCase() ?? ''
  return isCamelotCode(fromUrl) ? fromUrl : '8A'
}

export default function CamelotWheelPage() {
  const [selected, setSelected] = useState(initialKey)
  const [highlight, setHighlight] = useState<string | null>(null)
  const moves = useMemo(() => compatibleMoves(selected), [selected])
  const byCode = useMemo(() => new Map(moves.map((m) => [m.code, m])), [moves])
  const hue = camelotHue(selected) ?? 30
  const key = CAMELOT_KEYS[selected]!

  const select = (code: string, from: 'wheel' | 'list' | 'chart') => {
    setSelected(code)
    setHighlight(null)
    const url = new URL(window.location.href)
    url.searchParams.set('key', code)
    window.history.replaceState(null, '', url)
    trackEvent('camelot_key_selected', { key: code, from })
    if (from === 'chart') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-100 sm:text-4xl">
          Camelot Wheel
        </h1>
        <p className="text-neutral-300">
          Pick a key to see what mixes with it. The Camelot wheel is the shortcut to harmonic mixing
          — no music theory needed.
        </p>
      </div>

      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,460px)_1fr] lg:gap-12">
        <div className="relative mx-auto w-full max-w-[460px]">
          {/* Club light: a soft glow in the selected key's colour. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[-12%] rounded-full blur-3xl transition-[background] duration-700"
            style={{
              background: `radial-gradient(circle, hsl(${hue} 85% 50% / 0.22) 0%, hsl(${hue} 85% 40% / 0.08) 40%, transparent 68%)`,
            }}
          />
          <div className="relative">
            <CamelotWheel
              selected={selected}
              moves={byCode}
              highlight={highlight}
              onSelect={(code) => select(code, 'wheel')}
            />
          </div>
          <p className="relative mt-3 text-center text-xs text-neutral-500">
            Outer ring: major keys (B) · Inner ring: minor keys (A)
          </p>
        </div>

        <MovesPanel
          selected={selected}
          name={key.name}
          hue={hue}
          moves={moves}
          onHover={setHighlight}
          onSelect={(code) => select(code, 'list')}
        />
      </div>

      <KeyChart selected={selected} onSelect={(code) => select(code, 'chart')} />

      <section className="grid gap-6 text-sm text-neutral-400 sm:grid-cols-3">
        <div>
          <h2 className="mb-1.5 font-semibold text-neutral-200">What is the Camelot wheel?</h2>
          <p>
            A DJ-friendly map of the 24 musical keys. Each key gets a number from 1 to 12 and a
            letter: A for minor, B for major. Neighbouring numbers are a fifth apart, so they share
            most of their notes.
          </p>
        </div>
        <div>
          <h2 className="mb-1.5 font-semibold text-neutral-200">How to mix in key</h2>
          <p>
            From any key you can always go to the same code, one number up or down, or the same
            number with the other letter. Clockwise lifts the energy; counter-clockwise eases it
            off.
          </p>
        </div>
        <div>
          <h2 className="mb-1.5 font-semibold text-neutral-200">Find your tracks’ keys</h2>
          <p>
            Not sure what key a track is in?{' '}
            <a
              href={FINDER_PATH}
              onClick={linkHandler(FINDER_PATH)}
              className="text-signal-500 hover:text-signal-400"
            >
              The BPM &amp; key finder
            </a>{' '}
            reads it in your browser — and mixbuilder can order a whole set by key for you.
          </p>
        </div>
      </section>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/80 px-6 py-8 text-center">
        <p className="text-neutral-300">
          Let mixbuilder do the wheel for you: add your tracks and get a set ordered by key, tempo
          and energy.
        </p>
        <a
          href="/"
          onClick={linkHandler('/')}
          className="rounded-lg bg-signal-500 px-5 py-2.5 font-semibold text-neutral-950 transition hover:bg-signal-400"
        >
          Build a set in key — free
        </a>
      </div>
    </div>
  )
}

function MovesPanel({
  selected,
  name,
  hue,
  moves,
  onHover,
  onSelect,
}: {
  selected: string
  name: string
  hue: number
  moves: Move[]
  onHover: (code: string | null) => void
  onSelect: (code: string) => void
}) {
  const groups: { id: Move['group']; title: string; hint: string }[] = [
    { id: 'safe', title: 'Safe moves', hint: 'Blend cleanly almost anywhere' },
    { id: 'energy', title: 'Energy moves', hint: 'Bolder — use with intent' },
  ]
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-2xl sm:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Mixes with</p>
      <div className="mt-1 flex items-baseline gap-3">
        <span
          className="text-4xl font-extrabold tracking-tight"
          style={{ color: `hsl(${hue} 85% 66%)` }}
        >
          {selected}
        </span>
        <span className="text-lg text-neutral-300">{name}</span>
      </div>

      {groups.map((g) => (
        <div key={g.id} className="mt-5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-200">{g.title}</h2>
            <span className="text-[11px] text-neutral-500">{g.hint}</span>
          </div>
          <ul className="space-y-1">
            {moves
              .filter((m) => m.group === g.id)
              .map((m) => {
                const h = camelotHue(m.code) ?? 0
                return (
                  <li key={m.kind}>
                    <button
                      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-neutral-800/70"
                      onMouseEnter={() => onHover(m.code)}
                      onMouseLeave={() => onHover(null)}
                      onFocus={() => onHover(m.code)}
                      onBlur={() => onHover(null)}
                      onClick={() => onSelect(m.code)}
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                        style={{
                          background: `hsl(${h} ${g.id === 'safe' ? '62% 40%' : '45% 28%'})`,
                          color: g.id === 'safe' ? '#fff' : `hsl(${h} 70% 86%)`,
                          boxShadow: `0 0 18px hsl(${h} 80% 50% / ${g.id === 'safe' ? 0.35 : 0.15})`,
                        }}
                      >
                        {m.code}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-neutral-100">{m.title}</span>
                          <span className="font-mono text-[11px] text-neutral-500">{m.tag}</span>
                        </span>
                        <span className="block text-xs text-neutral-400">{m.detail}</span>
                      </span>
                      <span className="hidden shrink-0 text-xs text-neutral-500 sm:block">
                        {CAMELOT_KEYS[m.code]!.short}
                      </span>
                    </button>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function KeyChart({ selected, onSelect }: { selected: string; onSelect: (code: string) => void }) {
  const numbers = [...WHEEL_NUMBERS.slice(1), 12]
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">All 24 keys</h2>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-12">
        {(['A', 'B'] as const).flatMap((letter) =>
          numbers.map((n) => {
            const code = `${n}${letter}`
            const h = camelotHue(code) ?? 0
            const active = code === selected
            return (
              <button
                key={code}
                onClick={() => onSelect(code)}
                aria-pressed={active}
                className="rounded-lg border px-2 py-1.5 text-left transition hover:brightness-125"
                style={{
                  borderColor: active ? `hsl(${h} 80% 60%)` : 'rgb(38 38 38)',
                  background: active ? `hsl(${h} 60% 22%)` : `hsl(${h} 30% 10%)`,
                }}
              >
                <span className="block text-xs font-bold" style={{ color: `hsl(${h} 75% 70%)` }}>
                  {code}
                </span>
                <span className="block text-[11px] text-neutral-400">
                  {CAMELOT_KEYS[code]!.short}
                </span>
              </button>
            )
          }),
        )}
      </div>
    </section>
  )
}
