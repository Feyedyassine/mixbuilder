import {
  FEATURE_SCHEMA_VERSION,
  type InstrumentationProfile,
  type Section,
  type TrackFeatures,
} from '@/analysis/feature-schema'

// Builds well-formed TrackFeatures for scoring/optimizer tests without running
// real audio analysis. Only the fields the sequencer reads are meaningfully
// controllable (tempo, key/camelot, and the intro/outro sections); the rest get
// sensible defaults.

export interface SectionSpec {
  energy?: number
  percussiveness?: number
  bassWeight?: number
  brightness?: number
  density?: number
  vocalPresence?: number
}

export interface TrackSpec {
  bpm?: number
  camelot?: string
  key?: string
  scale?: 'major' | 'minor'
  keyConfidence?: number
  durationSec?: number
  intro?: SectionSpec
  outro?: SectionSpec
}

function profile(spec: SectionSpec = {}): InstrumentationProfile {
  return {
    percussiveness: spec.percussiveness ?? 0.5,
    bassWeight: spec.bassWeight ?? 0.5,
    brightness: spec.brightness ?? 0.5,
    density: spec.density ?? 0.5,
    ...(spec.vocalPresence !== undefined ? { vocalPresence: spec.vocalPresence } : {}),
  }
}

function section(
  label: Section['label'],
  startSec: number,
  endSec: number,
  spec: SectionSpec,
): Section {
  return { label, startSec, endSec, energy: spec.energy ?? 0.5, profile: profile(spec) }
}

export function makeTrack(spec: TrackSpec = {}): TrackFeatures {
  const durationSec = spec.durationSec ?? 300
  const bpm = spec.bpm ?? 128
  const a = durationSec * 0.15
  const b = durationSec * 0.85

  return {
    schemaVersion: FEATURE_SCHEMA_VERSION,
    durationSec,
    sampleRate: 44100,
    tempo: {
      bpm,
      confidence: 0.9,
      beatsSec: [],
      alternates: [Math.round(bpm / 2), Math.round(bpm * 2)],
    },
    key: {
      key: spec.key ?? 'C',
      scale: spec.scale ?? 'major',
      camelot: spec.camelot ?? '8B',
      confidence: spec.keyConfidence ?? 0.9,
    },
    energy: {
      curve: [spec.intro?.energy ?? 0.5, spec.outro?.energy ?? 0.5],
      hopSec: durationSec / 2,
      score: 5,
    },
    spikesSec: [],
    sections: [
      section('intro', 0, a, spec.intro ?? {}),
      section('build', a, b, {}),
      section('outro', b, durationSec, spec.outro ?? {}),
    ],
  }
}
