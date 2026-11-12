import type { SequencedSet } from '@/sequencing/sequencer'
import { ARC_LABELS } from '@/sequencing/arc'
import { formatMusicalKey } from './format'
import type { SetExport } from './types'

export interface TrackDisplay {
  fileName: string
  /** Path within the music folder the track was added from; see TrackFile.relativePath. */
  relativePath?: string
  title: string
  artist?: string
}

/** Map a SequencedSet + per-track display info into the writer-agnostic SetExport. */
export function buildSetExport(
  set: SequencedSet,
  displayById: Map<string, TrackDisplay>,
  name: string,
): SetExport {
  const tracks = set.order.map((t) => {
    const d = displayById.get(t.id)
    const fileName = d?.fileName || `${t.id}.mp3`
    return {
      fileName,
      relativePath: d?.relativePath || fileName,
      title: d?.title ?? d?.fileName ?? t.id,
      artist: d?.artist,
      bpm: t.features.tempo.bpm,
      camelot: t.features.key.camelot,
      musicalKey: formatMusicalKey(t.features.key),
      durationSec: t.features.durationSec,
    }
  })

  const transitions = set.transitions.map((tr) => ({
    scorePct: Math.round(tr.score.total * 100),
    warnings: tr.warnings,
    fromOutroStartSec: tr.mixPoint.fromStartSec,
    fromOutroEndSec: tr.mixPoint.fromEndSec,
    toIntroStartSec: tr.mixPoint.toStartSec,
    toIntroEndSec: tr.mixPoint.toEndSec,
  }))

  return {
    name,
    arcLabel: ARC_LABELS[set.arc],
    flowPct: Math.round(set.totalScore * 100),
    tracks,
    transitions,
  }
}
