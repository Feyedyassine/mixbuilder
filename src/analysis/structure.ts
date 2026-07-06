import type { SectionLabel } from './feature-schema'

// Structure segmentation for electronic music, driven by the energy curve (which
// defines EDM arrangement well). A novelty function on smoothed energy finds level
// changes; boundaries snap to the beat grid; sections are labeled by energy and
// position. Heuristic by design (PRD risk R3) — always yields ≥ intro/body/outro
// and is meant to be manually adjustable later.

export interface SectionSpan {
  label: SectionLabel
  startSec: number
  endSec: number
}

export interface SegmentOptions {
  minSectionSec?: number
  /** Novelty threshold (0–1) for a boundary. */
  noveltyThreshold?: number
}

function smooth(curve: number[], window: number): number[] {
  if (window <= 1) return curve.slice()
  const out = new Array<number>(curve.length)
  const half = Math.floor(window / 2)
  for (let i = 0; i < curve.length; i++) {
    let sum = 0
    let n = 0
    for (let j = Math.max(0, i - half); j <= Math.min(curve.length - 1, i + half); j++) {
      sum += curve[j]!
      n++
    }
    out[i] = sum / n
  }
  return out
}

/** Step-change novelty: |mean(before) − mean(after)| over a window each side. */
function noveltyCurve(curve: number[], window: number): number[] {
  const out = new Array<number>(curve.length).fill(0)
  for (let i = window; i < curve.length - window; i++) {
    let before = 0
    let after = 0
    for (let j = 1; j <= window; j++) {
      before += curve[i - j]!
      after += curve[i + j - 1]!
    }
    out[i] = Math.abs(after / window - before / window)
  }
  return out
}

function snapToBeat(timeSec: number, beatsSec: number[]): number {
  if (beatsSec.length === 0) return timeSec
  let best = beatsSec[0]!
  let bestDist = Math.abs(timeSec - best)
  for (const b of beatsSec) {
    const d = Math.abs(timeSec - b)
    if (d < bestDist) {
      best = b
      bestDist = d
    }
  }
  return best
}

function meanEnergy(curve: number[], startFrame: number, endFrame: number): number {
  let sum = 0
  let n = 0
  for (let i = startFrame; i < endFrame && i < curve.length; i++) {
    sum += curve[i]!
    n++
  }
  return n > 0 ? sum / n : 0
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/**
 * Estimate where a track's *musical* content ends, so a trailing reverb tail or
 * silence isn't mislabeled as the outro. Combines two signals: an energy floor
 * (cuts silence) and the beat grid (a decaying reverb has energy but no beats).
 * Clamped so a bad estimate can never trim more than the final ~40%.
 */
function findMusicalEndSec(
  smoothed: number[],
  hopSec: number,
  beatsSec: number[],
  durationSec: number,
): number {
  const maxE = Math.max(...smoothed, 1e-9)
  const active = smoothed.filter((v) => v >= 0.1 * maxE)
  const ref = active.length ? median(active) : maxE
  const floor = 0.15 * ref

  // Last frame still above the floor — trims a trailing silence.
  let endFrame = smoothed.length - 1
  while (endFrame > 0 && smoothed[endFrame]! < floor) endFrame--
  let end = Math.min(durationSec, (endFrame + 1) * hopSec)

  // If the beats stop earlier and what follows is a quiet decay (not a loud
  // beatless outro like a sustained pad), trim to just past the last beat —
  // this is the reverb-after-the-music-stops case.
  if (beatsSec.length >= 2) {
    const interval = (beatsSec[beatsSec.length - 1]! - beatsSec[0]!) / (beatsSec.length - 1)
    const beatEnd = Math.min(durationSec, beatsSec[beatsSec.length - 1]! + interval)
    if (beatEnd < end) {
      // Trim only if the post-beat tail is quieter than the body (a decay), not a
      // sustained beatless outro like a pad we'd want to keep as mixable material.
      const tail = meanEnergy(smoothed, Math.floor(beatEnd / hopSec), Math.floor(end / hopSec))
      if (tail < ref) end = beatEnd
    }
  }

  // Safety: never claim the music ends before the last half of the track.
  return Math.max(end, durationSec * 0.5)
}

function labelSections(boundariesSec: number[], curve: number[], hopSec: number): SectionSpan[] {
  const spans: SectionSpan[] = []
  const energies: number[] = []
  for (let s = 0; s < boundariesSec.length - 1; s++) {
    const startSec = boundariesSec[s]!
    const endSec = boundariesSec[s + 1]!
    energies.push(meanEnergy(curve, Math.floor(startSec / hopSec), Math.floor(endSec / hopSec)))
  }
  const maxE = Math.max(...energies, 1e-9)

  for (let s = 0; s < energies.length; s++) {
    const startSec = boundariesSec[s]!
    const endSec = boundariesSec[s + 1]!
    const rel = energies[s]! / maxE
    let label: SectionLabel
    if (s === 0) label = 'intro'
    else if (s === energies.length - 1) label = 'outro'
    else if (rel >= 0.8) label = 'drop'
    else if (rel <= 0.4) label = 'breakdown'
    else label = 'build'
    spans.push({ label, startSec, endSec })
  }
  return spans
}

/** Even intro/body/outro fallback for tracks with no clear structure. `endSec` is
 * the musical end (trailing silence/reverb already trimmed). */
function fallbackThirds(endSec: number, curve: number[], hopSec: number): SectionSpan[] {
  const a = endSec * 0.15
  const b = endSec * 0.85
  const midRel = meanEnergy(curve, Math.floor(a / hopSec), Math.floor(b / hopSec))
  const mid: SectionLabel = midRel >= 0.6 ? 'drop' : midRel <= 0.3 ? 'breakdown' : 'build'
  return [
    { label: 'intro', startSec: 0, endSec: a },
    { label: mid, startSec: a, endSec: b },
    { label: 'outro', startSec: b, endSec },
  ]
}

/**
 * Segment a track into labeled sections from its energy curve and beat grid.
 */
export function segmentStructure(
  curve: number[],
  hopSec: number,
  beatsSec: number[],
  durationSec: number,
  { minSectionSec = 8, noveltyThreshold = 0.12 }: SegmentOptions = {},
): SectionSpan[] {
  if (curve.length < 4 || durationSec <= 0) {
    return fallbackThirds(Math.max(durationSec, 0), curve, hopSec)
  }

  const smoothWindow = Math.max(1, Math.round(2 / hopSec))
  const noveltyWindow = Math.max(1, Math.round(4 / hopSec))
  const smoothed = smooth(curve, smoothWindow)
  const novelty = noveltyCurve(smoothed, noveltyWindow)

  // Trim any trailing reverb/silence so the outro is the last *musical* section.
  const endSec = findMusicalEndSec(smoothed, hopSec, beatsSec, durationSec)

  const minGapFrames = Math.max(1, Math.round(minSectionSec / hopSec))
  const peaks: number[] = []
  let last = -Infinity
  for (let i = 1; i < novelty.length - 1; i++) {
    if (
      novelty[i]! >= noveltyThreshold &&
      novelty[i]! >= novelty[i - 1]! &&
      novelty[i]! > novelty[i + 1]! &&
      i - last >= minGapFrames
    ) {
      peaks.push(i)
      last = i
    }
  }

  // Drop boundaries inside the trimmed tail, and any within one section of the
  // musical end so the outro stays a usable length rather than a final sliver.
  const kept = peaks.filter((p) => p * hopSec <= endSec - minSectionSec)
  if (kept.length === 0) return fallbackThirds(endSec, curve, hopSec)

  const boundaries = [0, ...kept.map((p) => snapToBeat(p * hopSec, beatsSec)), endSec]
  // Dedupe/clean any out-of-order or too-close boundaries after snapping.
  const cleaned = boundaries.filter((b, i, arr) => i === 0 || (b > arr[i - 1]! && b <= endSec))
  if (cleaned[cleaned.length - 1] !== endSec) cleaned.push(endSec)
  if (cleaned.length < 4) return fallbackThirds(endSec, curve, hopSec)

  return labelSections(cleaned, curve, hopSec)
}
