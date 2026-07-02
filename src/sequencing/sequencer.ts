import type { TrackFeatures } from '@/analysis/feature-schema'
import { introSection, outroSection, scoreTransition, type TransitionScore } from './scoring'
import { DEFAULT_WEIGHTS, type ScoringWeights } from './weights'
import { ARC_PRESETS, type ArcName, type ArcPreset } from './arc'

export interface AnalyzedTrack {
  id: string
  features: TrackFeatures
}

export interface ObjectiveWeights {
  /** Reward for smooth adjacent transitions. */
  transition: number
  /** Reward for matching the target energy/tempo arc. */
  arc: number
  /** Penalty for monotony (key streaks, texture sameness). */
  monotony: number
}

export const DEFAULT_OBJECTIVE_WEIGHTS: ObjectiveWeights = {
  transition: 1,
  arc: 0.5,
  monotony: 0.5,
}

export interface OptimizeOptions {
  arc?: ArcName
  /** Pin a track to the first slot. */
  startId?: string
  /** Pin a track to the last slot. */
  endId?: string
  weights?: ScoringWeights
  objectiveWeights?: ObjectiveWeights
  seed?: number
  iterations?: number
}

export interface MixPoint {
  fromStartSec: number
  fromEndSec: number
  toStartSec: number
  toEndSec: number
}

export interface TransitionInfo {
  fromId: string
  toId: string
  score: TransitionScore
  mixPoint: MixPoint
  warnings: string[]
}

export interface SequencedSet {
  order: AnalyzedTrack[]
  transitions: TransitionInfo[]
  /** Mean transition score across the set, 0–1 (user-facing). */
  totalScore: number
  /** Full optimizer objective (transition + arc − monotony); for comparison/telemetry. */
  objectiveScore: number
  arc: ArcName
}

// ── seeded RNG (mulberry32) — deterministic given a seed ──────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Context {
  tracks: AnalyzedTrack[]
  n: number
  scoreMatrix: number[][]
  energy: number[]
  bpmNorm: number[]
  camelot: string[]
  texture: { brightness: number; density: number; percussiveness: number }[]
  arc: ArcPreset
  ow: ObjectiveWeights
}

function trackTexture(f: TrackFeatures) {
  const a = outroSection(f).profile
  const b = introSection(f).profile
  return {
    brightness: (a.brightness + b.brightness) / 2,
    density: (a.density + b.density) / 2,
    percussiveness: (a.percussiveness + b.percussiveness) / 2,
  }
}

function buildContext(
  tracks: AnalyzedTrack[],
  arc: ArcPreset,
  weights: ScoringWeights,
  ow: ObjectiveWeights,
): Context {
  const n = tracks.length
  const scoreMatrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      scoreMatrix[i]![j] = scoreTransition(tracks[i]!.features, tracks[j]!.features, weights).total
    }
  }

  const bpms = tracks.map((t) => t.features.tempo.bpm)
  const bpmMin = Math.min(...bpms)
  const bpmMax = Math.max(...bpms)
  const span = bpmMax - bpmMin || 1

  return {
    tracks,
    n,
    scoreMatrix,
    energy: tracks.map((t) => t.features.energy.score / 10),
    bpmNorm: bpms.map((b) => (b - bpmMin) / span),
    camelot: tracks.map((t) => t.features.key.camelot),
    texture: tracks.map((t) => trackTexture(t.features)),
    arc,
    ow,
  }
}

function meanTransition(order: number[], ctx: Context): number {
  if (order.length < 2) return 0
  let sum = 0
  for (let i = 0; i < order.length - 1; i++) sum += ctx.scoreMatrix[order[i]!]![order[i + 1]!]!
  return sum / (order.length - 1)
}

function arcFit(order: number[], ctx: Context): number {
  const last = order.length - 1
  if (last <= 0) return 1
  let sum = 0
  for (let p = 0; p <= last; p++) {
    const target = ctx.arc(p / last)
    const idx = order[p]!
    const eDiff = Math.abs(ctx.energy[idx]! - target.energy)
    const tDiff = Math.abs(ctx.bpmNorm[idx]! - target.tempo)
    sum += 1 - (eDiff + tDiff) / 2
  }
  return sum / order.length
}

function monotonyPenalty(order: number[], ctx: Context): number {
  let keyPenalty = 0
  let run = 1
  for (let i = 1; i < order.length; i++) {
    const same =
      ctx.camelot[order[i]!] !== '' && ctx.camelot[order[i]!] === ctx.camelot[order[i - 1]!]
    if (same) {
      run++
      if (run >= 3) keyPenalty += 1
    } else {
      run = 1
    }
  }

  let texturePenalty = 0
  for (let i = 1; i < order.length; i++) {
    const a = ctx.texture[order[i - 1]!]!
    const b = ctx.texture[order[i]!]!
    const dist =
      Math.abs(a.brightness - b.brightness) +
      Math.abs(a.density - b.density) +
      Math.abs(a.percussiveness - b.percussiveness)
    if (dist < 0.15) texturePenalty += 0.15 - dist
  }

  return (keyPenalty + texturePenalty) / Math.max(1, order.length)
}

function objective(order: number[], ctx: Context): number {
  return (
    ctx.ow.transition * meanTransition(order, ctx) +
    ctx.ow.arc * arcFit(order, ctx) -
    ctx.ow.monotony * monotonyPenalty(order, ctx)
  )
}

/** Greedy nearest-neighbour ordering — the baseline the optimizer must beat. */
function greedy(ctx: Context, startIdx: number | null, endIdx: number | null): number[] {
  const used = new Array<boolean>(ctx.n).fill(false)
  const order: number[] = []
  let current = startIdx ?? 0
  if (endIdx !== null) used[endIdx] = true
  used[current] = true
  order.push(current)

  const remaining = ctx.n - (endIdx !== null ? 1 : 0)
  while (order.length < remaining) {
    let best = -1
    let bestScore = -Infinity
    for (let j = 0; j < ctx.n; j++) {
      if (used[j]) continue
      const s = ctx.scoreMatrix[current]![j]!
      if (s > bestScore) {
        bestScore = s
        best = j
      }
    }
    if (best === -1) break
    used[best] = true
    order.push(best)
    current = best
  }
  if (endIdx !== null) order.push(endIdx)
  return order
}

function anneal(
  ctx: Context,
  seedOrder: number[],
  seed: number,
  iterations: number,
  fixed: Set<number>,
): number[] {
  const rng = mulberry32(seed)

  const movable: number[] = []
  for (let p = 0; p < ctx.n; p++) if (!fixed.has(p)) movable.push(p)

  const order = seedOrder.slice()
  let current = objective(order, ctx)
  let best = order.slice()
  let bestObj = current

  if (movable.length < 2) return best

  let T = 0.15
  const cooling = Math.pow(0.001 / T, 1 / iterations)
  for (let k = 0; k < iterations; k++) {
    const pa = movable[Math.floor(rng() * movable.length)]!
    let pb = movable[Math.floor(rng() * movable.length)]!
    if (pa === pb) pb = movable[(movable.indexOf(pa) + 1) % movable.length]!
    ;[order[pa], order[pb]] = [order[pb]!, order[pa]!]
    const next = objective(order, ctx)
    const delta = next - current
    if (delta >= 0 || rng() < Math.exp(delta / T)) {
      current = next
      if (next > bestObj) {
        bestObj = next
        best = order.slice()
      }
    } else {
      ;[order[pa], order[pb]] = [order[pb]!, order[pa]!] // revert
    }
    T *= cooling
  }
  return best
}

function warningsFor(score: TransitionScore): string[] {
  const messages: Partial<Record<string, string>> = {
    key: 'Key clash',
    bpm: 'Tempo mismatch',
    energy: 'Energy jump',
    vocal: 'Vocal clash',
    bass: 'Bass conflict',
  }
  const out: string[] = []
  for (const t of score.terms) {
    if (t.available && t.score < 0.4 && messages[t.term]) out.push(messages[t.term]!)
  }
  return out
}

function assemble(
  order: number[],
  ctx: Context,
  weights: ScoringWeights,
  arcName: ArcName,
): SequencedSet {
  const tracks = order.map((i) => ctx.tracks[i]!)
  const transitions: TransitionInfo[] = []
  for (let i = 0; i < tracks.length - 1; i++) {
    const from = tracks[i]!
    const to = tracks[i + 1]!
    const score = scoreTransition(from.features, to.features, weights)
    const fo = outroSection(from.features)
    const ti = introSection(to.features)
    transitions.push({
      fromId: from.id,
      toId: to.id,
      score,
      mixPoint: {
        fromStartSec: fo.startSec,
        fromEndSec: fo.endSec,
        toStartSec: ti.startSec,
        toEndSec: ti.endSec,
      },
      warnings: warningsFor(score),
    })
  }
  const totalScore =
    transitions.length > 0
      ? transitions.reduce((s, t) => s + t.score.total, 0) / transitions.length
      : 0
  return {
    order: tracks,
    transitions,
    totalScore,
    objectiveScore: objective(order, ctx),
    arc: arcName,
  }
}

/**
 * Order a set of analyzed tracks to maximize transition quality and arc fit while
 * penalizing monotony. Honors start/end anchors. Deterministic given a seed.
 */
export function optimizeSet(tracks: AnalyzedTrack[], options: OptimizeOptions = {}): SequencedSet {
  const arcName = options.arc ?? 'journey'
  const weights = options.weights ?? DEFAULT_WEIGHTS
  const ow = options.objectiveWeights ?? DEFAULT_OBJECTIVE_WEIGHTS
  const seed = options.seed ?? 1
  const iterations = options.iterations ?? Math.min(20000, Math.max(2000, tracks.length * 400))

  if (tracks.length <= 1) {
    return assemble(
      tracks.map((_, i) => i),
      buildContext(tracks, ARC_PRESETS[arcName], weights, ow),
      weights,
      arcName,
    )
  }

  const ctx = buildContext(tracks, ARC_PRESETS[arcName], weights, ow)
  const idOf = new Map(tracks.map((t, i) => [t.id, i]))
  const startIdx = options.startId ? (idOf.get(options.startId) ?? null) : null
  const endIdx = options.endId ? (idOf.get(options.endId) ?? null) : null

  const seedOrder = greedy(ctx, startIdx, endIdx)

  const fixed = new Set<number>()
  if (startIdx !== null) fixed.add(0)
  if (endIdx !== null) fixed.add(seedOrder.length - 1)

  const best = anneal(ctx, seedOrder, seed, iterations, fixed)
  return assemble(best, ctx, weights, arcName)
}
