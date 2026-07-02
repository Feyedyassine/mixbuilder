// Target energy + tempo arcs for a set. Position t runs 0→1 across the set; each
// preset returns the desired normalized energy and tempo at that point. The
// optimizer rewards orderings whose tracks match these curves — this is what makes
// a set "go somewhere" instead of sitting flat (and, with the anti-monotony terms,
// keeps smoothness a constraint rather than the goal).

export type ArcName = 'warmup' | 'peak' | 'journey' | 'flat'

export interface ArcTarget {
  /** Desired normalized energy 0–1. */
  energy: number
  /** Desired normalized tempo 0–1 (mapped to the set's BPM range). */
  tempo: number
}

export type ArcPreset = (t: number) => ArcTarget

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

const warmup: ArcPreset = (t) => ({ energy: 0.2 + 0.7 * t, tempo: 0.3 + 0.5 * t })

const peak: ArcPreset = (t) => ({ energy: 0.75 + 0.2 * t, tempo: 0.7 + 0.2 * t })

// Rise to a late peak (~70% through), then ease down for the close.
const journey: ArcPreset = (t) => {
  const shape = t <= 0.7 ? 0.3 + (0.6 * t) / 0.7 : 0.9 - (0.4 * (t - 0.7)) / 0.3
  return { energy: clamp01(shape), tempo: clamp01(0.4 + 0.4 * Math.min(t / 0.7, 1)) }
}

const flat: ArcPreset = () => ({ energy: 0.6, tempo: 0.5 })

export const ARC_PRESETS: Record<ArcName, ArcPreset> = { warmup, peak, journey, flat }

export const ARC_LABELS: Record<ArcName, string> = {
  warmup: 'Warm-up',
  peak: 'Peak-time',
  journey: 'Journey',
  flat: 'Flat',
}
