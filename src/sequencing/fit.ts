import type { TrackFeatures } from '@/analysis/feature-schema'
import { introSection, outroSection, scoreTransition } from './scoring'
import { DEFAULT_WEIGHTS, type ScoringWeights } from './weights'
import type { AnalyzedTrack } from './sequencer'

// Fit detection (PRD F8): how well does each track sit in THIS playlist? Two views:
//   centroidFit    — distance from the playlist's own feature distribution
//   transitionFit  — best achievable transitions to/from the other tracks
// A misfit is flagged with a plain-language, feature-based reason. Detection is
// pure feature distance — no genre labels (honest-features principle); "hip-hop in
// a tech-house set" surfaces as BPM + texture deviation, and the DJ supplies the
// genre interpretation.

export interface FitThresholds {
  /** Combined fit below this flags a misfit. */
  misfit: number
  /** Robust-z above this makes a dimension worth mentioning in the reason. */
  deviation: number
}

export const DEFAULT_FIT_THRESHOLDS: FitThresholds = { misfit: 0.5, deviation: 2 }

export interface TrackFit {
  id: string
  centroidFit: number
  transitionFit: number
  fit: number
  isMisfit: boolean
  reasons: string[]
  /** Present when a kept outlier could bridge via half/double-time mixing. */
  bridge?: string
}

interface Dim {
  key: string
  values: number[]
  median: number
  mad: number
  describe: (higher: boolean) => string
  format?: (value: number, median: number) => string
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function avgProfile(f: TrackFeatures) {
  const a = outroSection(f).profile
  const b = introSection(f).profile
  return {
    percussiveness: (a.percussiveness + b.percussiveness) / 2,
    bassWeight: (a.bassWeight + b.bassWeight) / 2,
    brightness: (a.brightness + b.brightness) / 2,
    density: (a.density + b.density) / 2,
  }
}

function buildDims(tracks: AnalyzedTrack[]): Dim[] {
  const feat = tracks.map((t) => t.features)
  const prof = feat.map(avgProfile)
  const specs: {
    key: string
    values: number[]
    describe: (h: boolean) => string
    format?: Dim['format']
  }[] = [
    {
      key: 'bpm',
      values: feat.map((f) => f.tempo.bpm),
      describe: (h) => (h ? 'faster than the set' : 'slower than the set'),
      format: (v, m) => `${Math.round(v)} BPM vs set median ${Math.round(m)}`,
    },
    {
      key: 'energy',
      values: feat.map((f) => f.energy.score),
      describe: (h) => (h ? 'higher energy than the set' : 'lower energy than the set'),
      format: (v, m) => `energy ${v.toFixed(1)} vs set median ${m.toFixed(1)}`,
    },
    {
      key: 'percussiveness',
      values: prof.map((p) => p.percussiveness),
      describe: (h) => (h ? 'more percussive than the set' : 'less percussive than the set'),
    },
    {
      key: 'bass',
      values: prof.map((p) => p.bassWeight),
      describe: (h) => (h ? 'bass-heavier than the set' : 'lighter on bass than the set'),
    },
    {
      key: 'brightness',
      values: prof.map((p) => p.brightness),
      describe: (h) => (h ? 'brighter than the set' : 'darker than the set'),
    },
    {
      key: 'density',
      values: prof.map((p) => p.density),
      describe: (h) => (h ? 'denser than the set' : 'sparser than the set'),
    },
  ]
  return specs.map((s) => {
    const med = median(s.values)
    const mad = median(s.values.map((v) => Math.abs(v - med)))
    return { ...s, median: med, mad }
  })
}

function robustZ(value: number, dim: Dim): number {
  const scale = 1.4826 * dim.mad
  if (scale < 1e-9) return 0
  return (value - dim.median) / scale
}

function scoreMatrixOf(tracks: AnalyzedTrack[], weights: ScoringWeights): number[][] {
  const n = tracks.length
  const m: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j)
        m[i]![j] = scoreTransition(tracks[i]!.features, tracks[j]!.features, weights).total
    }
  }
  return m
}

/** Compute per-track fit within the given playlist. */
export function computeFits(
  tracks: AnalyzedTrack[],
  thresholds: FitThresholds = DEFAULT_FIT_THRESHOLDS,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): TrackFit[] {
  const n = tracks.length
  if (n <= 1) {
    return tracks.map((t) => ({
      id: t.id,
      centroidFit: 1,
      transitionFit: 1,
      fit: 1,
      isMisfit: false,
      reasons: [],
    }))
  }

  const dims = buildDims(tracks)
  const matrix = scoreMatrixOf(tracks, weights)
  const bpmMedian = dims.find((d) => d.key === 'bpm')!.median

  return tracks.map((track, i) => {
    // Centroid fit from robust z-distance across dimensions.
    let sumSq = 0
    const perDim = dims.map((d) => {
      const z = robustZ(d.values[i]!, d)
      sumSq += z * z
      return { dim: d, z }
    })
    const rmsZ = Math.sqrt(sumSq / dims.length)
    const centroidFit = Math.min(1, Math.max(0, 1 - rmsZ / 2))

    // Transition fit from best achievable in/out transitions.
    let bestOut = 0
    let bestIn = 0
    for (let j = 0; j < n; j++) {
      if (j === i) continue
      bestOut = Math.max(bestOut, matrix[i]![j]!)
      bestIn = Math.max(bestIn, matrix[j]![i]!)
    }
    const transitionFit = (bestOut + bestIn) / 2

    const fit = 0.5 * centroidFit + 0.5 * transitionFit
    const isMisfit = fit < thresholds.misfit

    const reasons: string[] = []
    if (isMisfit) {
      const flagged = perDim
        .filter((p) => Math.abs(p.z) >= thresholds.deviation)
        .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
        .slice(0, 2)
      for (const { dim, z } of flagged) {
        reasons.push(dim.format ? dim.format(dim.values[i]!, dim.median) : dim.describe(z > 0))
      }
      if (reasons.length === 0) reasons.push('sits apart from the rest of the set')
    }

    const fit_: TrackFit = { id: track.id, centroidFit, transitionFit, fit, isMisfit, reasons }

    // Half/double-time bridge hint for a kept tempo outlier.
    const bpm = track.features.tempo.bpm
    if (isMisfit && bpmMedian > 0) {
      const ratio = bpm / bpmMedian
      if (Math.abs(ratio - 0.5) < 0.06) fit_.bridge = 'Mix at double-time to match the set tempo'
      else if (Math.abs(ratio - 2) < 0.12) fit_.bridge = 'Mix at half-time to match the set tempo'
    }
    return fit_
  })
}
