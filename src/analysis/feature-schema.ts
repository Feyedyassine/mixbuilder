// The feature-JSON schema is the contract between the analysis engine and
// everything downstream (cache, sequencing, UI). Any analyzer that fills this
// shape is a drop-in replacement — the engine (Essentia today) is an
// implementation detail behind the Analyzer interface.
//
// Provisional through Phase 2: Chunk 2.3 adds `sections` + `instrumentation`.
// Bump FEATURE_SCHEMA_VERSION on any breaking change; it keys the community
// cache so entries computed by an older shape/engine are superseded, not mixed.

export const FEATURE_SCHEMA_VERSION = 1

export interface TempoFeatures {
  /** Estimated tempo in BPM. */
  bpm: number
  /** Beat-tracker confidence, 0–1. */
  confidence: number
  /** Beat tick positions in seconds. */
  beatsSec: number[]
  /** Half/double-time candidates (for BPM-compatible mixing across tempos). */
  alternates: number[]
}

export interface KeyFeatures {
  /** Pitch class, e.g. "C", "F#". */
  key: string
  scale: 'major' | 'minor'
  /** Camelot-wheel code, e.g. "8B". */
  camelot: string
  /** Key-estimation strength, 0–1. */
  confidence: number
}

export interface EnergyFeatures {
  /** Per-track-normalized energy over time, 0–1 (shape for the timeline). */
  curve: number[]
  /** Seconds between successive curve samples. */
  hopSec: number
  /** Absolute energy on a 1–10 scale (loudness-based, comparable across tracks). */
  score: number
}

export interface TrackFeatures {
  schemaVersion: number
  durationSec: number
  /** Sample rate the analysis ran at. */
  sampleRate: number
  tempo: TempoFeatures
  key: KeyFeatures
  energy: EnergyFeatures
  /** Times (seconds) of energy spikes — drops, impacts, major transitions. */
  spikesSec: number[]
}
