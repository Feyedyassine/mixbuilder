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

export type SectionLabel = 'intro' | 'build' | 'drop' | 'breakdown' | 'outro'

/**
 * Per-section instrumentation profile (PRD F2). Honest features only: reliable
 * spectral aggregates, each normalized 0–1. No genre or specific-instrument
 * claims. `vocalPresence` is optional — populated once the voice/instrumental
 * model lands; absent means "not yet measured", never "no vocals".
 */
export interface InstrumentationProfile {
  /** Transient/percussive content, 0–1 (spectral-flux based). */
  percussiveness: number
  /** Share of energy in the low band, 0–1. */
  bassWeight: number
  /** Normalized spectral centroid, 0–1 (dark → bright). */
  brightness: number
  /** Layer density from spectral flatness, 0–1 (sparse → dense). */
  density: number
  /** Vocal activity 0–1; optional until the vocal model is integrated. */
  vocalPresence?: number
}

export interface Section {
  label: SectionLabel
  startSec: number
  endSec: number
  /** Mean normalized energy of the section, 0–1 (from the energy curve). */
  energy: number
  profile: InstrumentationProfile
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
  /** Structural sections (intro/build/drop/breakdown/outro) with profiles. */
  sections: Section[]
}
