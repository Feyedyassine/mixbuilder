// Central, tunable scoring weights (plan Chunk 3.1 / rule scoring.md). Every
// transition-scoring term's weight lives here so tuning is one edit, and the
// optimizer + UI read the same source of truth. Weights need not sum to 1 — the
// total renormalizes over whichever terms are available for a given pair.

export interface ScoringWeights {
  /** Harmonic compatibility (Camelot distance). */
  key: number
  /** Tempo compatibility, including half/double-time. */
  bpm: number
  /** Energy continuity across the junction (A.outro ↔ B.intro). */
  energy: number
  /** Vocal-clash avoidance (active only once vocal presence is measured). */
  vocal: number
  /** Percussive/melodic handoff match. */
  percussive: number
  /** Bass-weight conflict avoidance. */
  bass: number
  /** Brightness + density continuity. */
  texture: number
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  key: 0.25,
  bpm: 0.25,
  energy: 0.15,
  vocal: 0.1,
  percussive: 0.1,
  bass: 0.075,
  texture: 0.075,
}
