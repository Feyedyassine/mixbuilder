import type { SequencedSet } from '@/sequencing/sequencer'
import type { TrackDisplay } from '@/export/build'
import { SHARE_VERSION, type SharedSet } from './schema'

// Turn a built set into the share payload. Values are clamped/rounded to what
// parseSharedSet accepts so an odd analysis result can't make the server reject
// the whole set.

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))
const round = (x: number, digits: number) => Math.round(x * 10 ** digits) / 10 ** digits

export function buildSharedSet(
  set: SequencedSet,
  displayById: Map<string, TrackDisplay>,
  name: string,
): SharedSet {
  return {
    version: SHARE_VERSION,
    name: name.trim().slice(0, 80) || 'Untitled set',
    arc: set.arc,
    flow: round(clamp(set.totalScore, 0, 1), 3),
    transitions: set.transitions.map((t) => round(clamp(t.score.total, 0, 1), 3)),
    tracks: set.order.map((t) => {
      const d = displayById.get(t.id)
      const title = (d?.title || d?.fileName || 'Untitled').trim().slice(0, 200) || 'Untitled'
      const artist = d?.artist?.trim().slice(0, 200)
      return {
        hash: t.id,
        title,
        ...(artist ? { artist } : {}),
        bpm: round(clamp(t.features.tempo.bpm, 40, 250), 1),
        camelot: t.features.key.camelot,
        energy: round(clamp(t.features.energy.score, 0, 10), 1),
      }
    }),
  }
}

/** Plain-text tracklist, e.g. for pasting into a post or a message. */
export function tracklistText(set: SharedSet): string {
  return set.tracks
    .map((t, i) => {
      const who = t.artist ? `${t.artist} – ${t.title}` : t.title
      return `${i + 1}. ${who} (${t.camelot}, ${Math.round(t.bpm)} BPM)`
    })
    .join('\n')
}
