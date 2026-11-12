import { useEffect, useState } from 'react'
import { ARC_LABELS } from '@/sequencing/arc'
import { fetchShare } from '@/share/api'
import { tracklistText } from '@/share/build'
import type { SharedSet } from '@/share/schema'
import { saveSet } from '@/storage/sets-store'
import { useSavedSets } from '@/state/saved-sets'
import { trackEvent } from '@/lib/analytics'
import { ArcChart, KeyChip } from '@/ui/track-visuals'

// Read-only view of a shared set (/s/:id). Shows the snapshot — tracklist, keys,
// BPM, energy arc and transition scores — and lets the viewer copy the tracklist
// or save the set to their own (browser) sets. It doubles as a landing page for
// new visitors, so it always offers "build your own".

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; set: SharedSet }

const scoreColor = (x: number) => (x >= 0.75 ? '#34d399' : x >= 0.5 ? '#f5a623' : '#f87171')

const button =
  'rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40'

export default function SharedSetView({ id }: { id: string }) {
  const sets = useSavedSets()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    fetchShare(id).then(
      (set) => {
        if (!active) return
        setState(set ? { status: 'ready', set } : { status: 'missing' })
        if (set) {
          document.title = `${set.name} — mixbuilder`
          trackEvent('shared_set_viewed', { track_count: set.tracks.length })
        }
      },
      () => active && setState({ status: 'error' }),
    )
    return () => {
      active = false
    }
  }, [id])

  if (state.status !== 'ready') {
    const message = {
      loading: 'Loading set…',
      missing: 'This set link doesn’t exist.',
      error: 'Couldn’t load this set — check your connection and try again.',
    }[state.status]
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 py-16 text-center">
        <p
          className={
            state.status === 'loading' ? 'animate-pulse text-neutral-400' : 'text-neutral-300'
          }
        >
          {message}
        </p>
        {state.status !== 'loading' && <CallToAction />}
      </div>
    )
  }

  const { set } = state

  const copyTracklist = async () => {
    await navigator.clipboard.writeText(tracklistText(set)).then(
      () => {
        setCopied(true)
        trackEvent('shared_tracklist_copied', { track_count: set.tracks.length })
      },
      () => {},
    )
  }

  const saveToMySets = async () => {
    await saveSet(set.name, {
      version: 1,
      arc: set.arc,
      tracks: set.tracks.map((t) => ({
        hash: t.hash,
        fileName: '',
        title: t.title,
        ...(t.artist ? { artist: t.artist } : {}),
        bpm: t.bpm,
        camelot: t.camelot,
      })),
    })
    await sets.refresh()
    setSaved(true)
    trackEvent('shared_set_saved', { track_count: set.tracks.length })
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/95 p-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Shared set</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-100">{set.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-lg tabular-nums text-signal-500">
            {(set.flow * 100).toFixed(0)}%
          </span>
          <span className="text-sm text-neutral-400">
            flow · {ARC_LABELS[set.arc]} · {set.tracks.length} tracks
          </span>
        </div>
        <ArcChart
          energies={set.tracks.map((t) => t.energy / 10)}
          arc={set.arc}
          className="mt-3 h-14 w-full"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={button} onClick={() => void copyTracklist()}>
            {copied ? 'Tracklist copied' : 'Copy tracklist'}
          </button>
          <button className={button} onClick={() => void saveToMySets()} disabled={saved}>
            {saved ? 'Saved to your sets' : 'Save to my sets'}
          </button>
        </div>
        {saved && (
          <p className="mt-2 text-xs text-neutral-500">
            Saved in this browser. Add the same audio files, then open it from Sets to edit or
            export it.
          </p>
        )}
      </div>

      <ol className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/95">
        {set.tracks.map((t, i) => (
          <li key={`${t.hash}-${i}`}>
            {i > 0 && (
              <div className="border-y border-neutral-800/60 bg-neutral-950/40 px-4 py-1 font-mono text-xs tabular-nums">
                <span style={{ color: scoreColor(set.transitions[i - 1] ?? 0) }}>
                  ↓ {((set.transitions[i - 1] ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-6 shrink-0 text-right font-mono text-xs text-neutral-600">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-neutral-100">{t.title}</div>
                {t.artist && <div className="truncate text-xs text-neutral-500">{t.artist}</div>}
              </div>
              <KeyChip camelot={t.camelot} />
              <span className="w-14 shrink-0 text-right font-mono text-sm tabular-nums text-neutral-200">
                {t.bpm.toFixed(0)}
                <span className="ml-0.5 text-[9px] text-neutral-600">bpm</span>
              </span>
            </div>
          </li>
        ))}
      </ol>

      <CallToAction />
    </div>
  )
}

function CallToAction() {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="text-sm text-neutral-400">
        Turn your own tracks into a set that flows — free, right in your browser.
      </p>
      <a
        href="/"
        className="rounded-lg bg-signal-500 px-5 py-2.5 font-semibold text-neutral-950 transition hover:bg-signal-400"
      >
        Build your own set
      </a>
    </div>
  )
}
