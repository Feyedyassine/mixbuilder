import { rms } from './dsp'
import type { EnergyFeatures } from './feature-schema'

// Engine-agnostic energy analysis (pure DSP). The curve is per-track normalized
// (shape); the score is absolute loudness (comparable across tracks).

export const DEFAULT_HOP_SEC = 0.25

/** Framed RMS over the signal, normalized to 0–1 by the track's own peak. */
export function energyCurve(
  mono: Float32Array,
  sampleRate: number,
  hopSec: number = DEFAULT_HOP_SEC,
): { curve: number[]; hopSec: number } {
  const hop = Math.max(1, Math.floor(sampleRate * hopSec))
  const frames = Math.ceil(mono.length / hop)
  const raw = new Array<number>(frames)
  let peak = 0
  for (let f = 0; f < frames; f++) {
    const start = f * hop
    const frame = mono.subarray(start, Math.min(start + hop, mono.length))
    const value = rms(frame)
    raw[f] = value
    if (value > peak) peak = value
  }
  const curve = peak > 0 ? raw.map((v) => v / peak) : raw.map(() => 0)
  return { curve, hopSec }
}

/**
 * Absolute energy on a 1–10 scale from overall loudness (dBFS). The mapping range
 * (−30…−6 dBFS → 1…10) is a v1 heuristic; Chunk 2.4 tunes it against references.
 */
export function energyScore(mono: Float32Array): number {
  const overall = rms(mono)
  if (overall <= 0) return 1
  const dbfs = 20 * Math.log10(overall)
  const min = -30
  const max = -6
  const t = (dbfs - min) / (max - min)
  const score = 1 + 9 * Math.min(1, Math.max(0, t))
  return Math.round(score * 10) / 10
}

/**
 * Spike times (seconds) from sharp rises in the energy curve — drops, impacts,
 * major transitions. A refractory gap prevents one drop registering repeatedly.
 */
export function detectSpikes(
  curve: number[],
  hopSec: number,
  {
    riseThreshold = 0.25,
    minLevel = 0.5,
    minGapSec = 2,
  }: { riseThreshold?: number; minLevel?: number; minGapSec?: number } = {},
): number[] {
  const spikes: number[] = []
  const minGapFrames = Math.max(1, Math.round(minGapSec / hopSec))
  let lastSpikeFrame = -Infinity
  for (let i = 1; i < curve.length; i++) {
    const rise = curve[i]! - curve[i - 1]!
    if (rise >= riseThreshold && curve[i]! >= minLevel && i - lastSpikeFrame >= minGapFrames) {
      spikes.push(i * hopSec)
      lastSpikeFrame = i
    }
  }
  return spikes
}

export function analyzeEnergy(
  mono: Float32Array,
  sampleRate: number,
  hopSec: number = DEFAULT_HOP_SEC,
): { energy: EnergyFeatures; spikesSec: number[] } {
  const { curve } = energyCurve(mono, sampleRate, hopSec)
  const score = energyScore(mono)
  const spikesSec = detectSpikes(curve, hopSec)
  return { energy: { curve, hopSec, score }, spikesSec }
}
