// Normalized, writer-agnostic view of a sequenced set. The UI builds this from a
// SequencedSet + the picked files; each format writer consumes it.

export interface SetExportTrack {
  fileName: string
  title: string
  artist?: string
  bpm: number
  /** Camelot code, e.g. "8A". */
  camelot: string
  /** Musical key, e.g. "Am" / "C". */
  musicalKey: string
  durationSec: number
}

export interface SetExportTransition {
  /** Flow score for this junction, 0–100. */
  scorePct: number
  warnings: string[]
  fromOutroStartSec: number
  fromOutroEndSec: number
  toIntroStartSec: number
  toIntroEndSec: number
}

export interface SetExport {
  name: string
  arcLabel: string
  /** Overall flow, 0–100. */
  flowPct: number
  tracks: SetExportTrack[]
  /** One per junction; length = tracks.length − 1. */
  transitions: SetExportTransition[]
}
