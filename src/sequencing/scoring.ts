import type { Section, TrackFeatures } from '@/analysis/feature-schema'
import { DEFAULT_WEIGHTS, type ScoringWeights } from './weights'

// Directional transition scoring: how well does track `from` mix into track `to`?
// Section-aware — it compares `from`'s OUTRO to `to`'s INTRO, not track averages —
// so score(A→B) ≠ score(B→A) in general. Each term is 0–1 (1 = ideal); the total
// is a weighted average over the terms that are available for this pair (e.g. the
// vocal term is skipped until vocal presence is measured), with weights
// renormalized so a missing term neither helps nor hurts.

export type TermName = 'key' | 'bpm' | 'energy' | 'vocal' | 'percussive' | 'bass' | 'texture'

export interface TermScore {
  term: TermName
  score: number
  weight: number
  available: boolean
  note: string
}

export interface TransitionScore {
  /** Weighted average over available terms, 0–1. */
  total: number
  terms: TermScore[]
}

const BPM_TOLERANCE = 0.06 // ±6% (incl. half/double) → score fades to 0

export function outroSection(track: TrackFeatures): Section {
  const outro = [...track.sections].reverse().find((s) => s.label === 'outro')
  return outro ?? track.sections[track.sections.length - 1]!
}

export function introSection(track: TrackFeatures): Section {
  return track.sections.find((s) => s.label === 'intro') ?? track.sections[0]!
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

interface Camelot {
  number: number
  letter: 'A' | 'B'
}

function parseCamelot(code: string): Camelot | null {
  const m = /^(\d{1,2})([AB])$/.exec(code)
  if (!m) return null
  const number = Number(m[1])
  if (number < 1 || number > 12) return null
  return { number, letter: m[2] as 'A' | 'B' }
}

function circularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 12
  return Math.min(d, 12 - d)
}

function keyTerm(from: TrackFeatures, to: TrackFeatures, weight: number): TermScore {
  const a = parseCamelot(from.key.camelot)
  const b = parseCamelot(to.key.camelot)
  if (!a || !b) {
    return { term: 'key', score: 0, weight, available: false, note: 'Key: unknown' }
  }
  const dist = circularDistance(a.number, b.number)
  const sameLetter = a.letter === b.letter
  const score = clamp01((sameLetter ? 1.0 : 0.9) - dist * 0.15)
  let relation: string
  if (dist === 0 && sameLetter) relation = 'same key'
  else if (dist === 0) relation = 'relative major/minor'
  else if (dist === 1 && sameLetter) relation = 'adjacent (±1)'
  else relation = `${dist} steps apart`
  return {
    term: 'key',
    score,
    weight,
    available: true,
    note: `Key ${from.key.camelot}→${to.key.camelot}: ${relation}`,
  }
}

function bpmTerm(from: TrackFeatures, to: TrackFeatures, weight: number): TermScore {
  const f = from.tempo.bpm
  const candidates = [to.tempo.bpm, to.tempo.bpm / 2, to.tempo.bpm * 2]
  let bestRatio = Infinity
  let bestCand = to.tempo.bpm
  for (const c of candidates) {
    if (c <= 0) continue
    const ratio = Math.max(f, c) / Math.min(f, c)
    if (ratio < bestRatio) {
      bestRatio = ratio
      bestCand = c
    }
  }
  const score = clamp01(1 - (bestRatio - 1) / BPM_TOLERANCE)
  const rel =
    bestCand === to.tempo.bpm ? '' : bestCand > to.tempo.bpm ? ' (double-time)' : ' (half-time)'
  return {
    term: 'bpm',
    score,
    weight,
    available: true,
    note: `BPM ${f.toFixed(1)}→${to.tempo.bpm.toFixed(1)}${rel}`,
  }
}

function continuityTerm(
  term: TermName,
  outroVal: number,
  introVal: number,
  weight: number,
  label: string,
): TermScore {
  const score = clamp01(1 - Math.abs(outroVal - introVal))
  return {
    term,
    score,
    weight,
    available: true,
    note: `${label} ${outroVal.toFixed(2)}→${introVal.toFixed(2)}`,
  }
}

function vocalTerm(outro: Section, intro: Section, weight: number): TermScore {
  const ov = outro.profile.vocalPresence
  const iv = intro.profile.vocalPresence
  if (ov === undefined || iv === undefined) {
    return { term: 'vocal', score: 0, weight, available: false, note: 'Vocal: not measured' }
  }
  const clash = ov * iv
  return {
    term: 'vocal',
    score: clamp01(1 - clash),
    weight,
    available: true,
    note: clash > 0.4 ? 'Vocal clash risk (both sections have vocals)' : 'No vocal clash',
  }
}

function bassTerm(outro: Section, intro: Section, weight: number): TermScore {
  const conflict = outro.profile.bassWeight * intro.profile.bassWeight
  return {
    term: 'bass',
    score: clamp01(1 - conflict),
    weight,
    available: true,
    note: conflict > 0.5 ? 'Bass conflict (both bass-heavy)' : 'Bass compatible',
  }
}

function textureTerm(outro: Section, intro: Section, weight: number): TermScore {
  const brightnessDiff = Math.abs(outro.profile.brightness - intro.profile.brightness)
  const densityDiff = Math.abs(outro.profile.density - intro.profile.density)
  return {
    term: 'texture',
    score: clamp01(1 - (brightnessDiff + densityDiff) / 2),
    weight,
    available: true,
    note: `Texture Δbright ${brightnessDiff.toFixed(2)}, Δdensity ${densityDiff.toFixed(2)}`,
  }
}

/** Score the transition from `from`'s outro into `to`'s intro. */
export function scoreTransition(
  from: TrackFeatures,
  to: TrackFeatures,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): TransitionScore {
  const outro = outroSection(from)
  const intro = introSection(to)

  const terms: TermScore[] = [
    keyTerm(from, to, weights.key),
    bpmTerm(from, to, weights.bpm),
    continuityTerm('energy', outro.energy, intro.energy, weights.energy, 'Energy'),
    vocalTerm(outro, intro, weights.vocal),
    continuityTerm(
      'percussive',
      outro.profile.percussiveness,
      intro.profile.percussiveness,
      weights.percussive,
      'Percussion',
    ),
    bassTerm(outro, intro, weights.bass),
    textureTerm(outro, intro, weights.texture),
  ]

  let weighted = 0
  let available = 0
  for (const t of terms) {
    if (!t.available) continue
    weighted += t.score * t.weight
    available += t.weight
  }
  const total = available > 0 ? weighted / available : 0
  return { total, terms }
}
