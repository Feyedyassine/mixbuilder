import type Essentia from 'essentia.js/dist/essentia.js-core.es.js'
import type { EssentiaVector } from 'essentia.js/dist/essentia.js-core.es.js'
import type { Analyzer } from './analyzer'
import { FEATURE_SCHEMA_VERSION, type Section, type TrackFeatures } from './feature-schema'
import { toCamelot } from './camelot'
import { analyzeEnergy } from './energy'
import { segmentStructure } from './structure'
import { profileForRange, spectralFrames } from './spectral'

// RhythmExtractor2013 'multifeature' reports confidence on roughly a 0–5.32
// scale; normalize into the schema's 0–1.
const MAX_RHYTHM_CONFIDENCE = 5.32

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function meanInRange(values: number[], startFrame: number, endFrame: number): number {
  const s = Math.floor(startFrame)
  const e = Math.max(s + 1, Math.floor(endFrame))
  let sum = 0
  let n = 0
  for (let i = s; i < e && i < values.length; i++) {
    sum += values[i]!
    n++
  }
  return n > 0 ? sum / n : 0
}

function normalizeScale(scale: string): 'major' | 'minor' {
  return scale === 'minor' ? 'minor' : 'major'
}

/**
 * Essentia-backed analyzer. Only BPM and key come from Essentia; energy, the
 * energy curve, and spikes are engine-agnostic pure DSP (see energy.ts). Owns no
 * long-lived WASM state beyond the shared Essentia instance; every per-call
 * vector is deleted to keep the heap flat across large batches.
 */
export class EssentiaAnalyzer implements Analyzer {
  private readonly essentia: Essentia

  constructor(essentia: Essentia) {
    this.essentia = essentia
  }

  analyze(mono: Float32Array, sampleRate: number): TrackFeatures {
    const durationSec = mono.length / sampleRate
    const signal = this.essentia.arrayToVector(mono)
    let tempo, key
    try {
      tempo = this.analyzeTempo(signal)
      key = this.analyzeKey(signal, sampleRate)
    } finally {
      signal.delete()
    }

    const { energy, spikesSec } = analyzeEnergy(mono, sampleRate)
    const sections = this.analyzeSections(mono, sampleRate, energy, tempo.beatsSec, durationSec)

    return {
      schemaVersion: FEATURE_SCHEMA_VERSION,
      durationSec,
      sampleRate,
      tempo,
      key,
      energy,
      spikesSec,
      sections,
    }
  }

  private analyzeSections(
    mono: Float32Array,
    sampleRate: number,
    energy: { curve: number[]; hopSec: number },
    beatsSec: number[],
    durationSec: number,
  ): Section[] {
    const spans = segmentStructure(energy.curve, energy.hopSec, beatsSec, durationSec)
    const spectral = spectralFrames(this.essentia, mono, sampleRate)
    return spans.map((span) => ({
      ...span,
      energy: meanInRange(energy.curve, span.startSec / energy.hopSec, span.endSec / energy.hopSec),
      profile: profileForRange(spectral, span.startSec, span.endSec),
    }))
  }

  private analyzeTempo(signal: EssentiaVector) {
    const rhythm = this.essentia.RhythmExtractor2013(signal, 208, 'multifeature', 40)
    try {
      const beatsSec = Array.from(this.essentia.vectorToArray(rhythm.ticks))
      const bpm = rhythm.bpm
      return {
        bpm,
        confidence: clamp01(rhythm.confidence / MAX_RHYTHM_CONFIDENCE),
        beatsSec,
        alternates: [Math.round(bpm / 2), Math.round(bpm * 2)],
      }
    } finally {
      rhythm.ticks.delete()
      rhythm.estimates.delete()
      rhythm.bpmIntervals.delete()
    }
  }

  private analyzeKey(signal: EssentiaVector, sampleRate: number) {
    const result = this.essentia.KeyExtractor(
      signal,
      true,
      4096,
      4096,
      12,
      3500,
      60,
      25,
      0.2,
      'bgate',
      sampleRate,
    )
    const scale = normalizeScale(result.scale)
    return {
      key: result.key,
      scale,
      camelot: toCamelot(result.key, scale),
      confidence: clamp01(result.strength),
    }
  }
}
