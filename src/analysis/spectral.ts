import type Essentia from 'essentia.js/dist/essentia.js-core.es.js'
import type { InstrumentationProfile } from './feature-schema'

// Per-frame spectral features, aggregated per section into the instrumentation
// profile. Uses Essentia for the FFT + spectral descriptors; the aggregation
// (profileForRange) is pure. Frames are non-overlapping and coarse — section
// profiles don't need fine time resolution, and it keeps the pass fast.

const FRAME_SIZE = 4096

export interface FrameSpectralFeatures {
  hopSec: number
  /** Normalized spectral centroid 0–1 (brightness). */
  brightness: number[]
  /** Spectral flatness 0–1 (density proxy). */
  flatness: number[]
  /** Low-band energy ratio 0–1 (bass weight). */
  bassRatio: number[]
  /** Rising spectral flux 0–1 (percussiveness proxy). */
  flux: number[]
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  return Math.min(1, Math.max(0, x))
}

/** Compute per-frame spectral features across the whole signal in one pass. */
export function spectralFrames(
  essentia: Essentia,
  mono: Float32Array,
  sampleRate: number,
  frameSize: number = FRAME_SIZE,
): FrameSpectralFeatures {
  const nyquist = sampleRate / 2
  const brightness: number[] = []
  const flatness: number[] = []
  const bassRatio: number[] = []
  const flux: number[] = []

  let prevSpectrum: Float32Array | null = null

  for (let start = 0; start + frameSize <= mono.length; start += frameSize) {
    const frameArr = mono.subarray(start, start + frameSize)
    const vec = essentia.arrayToVector(frameArr as Float32Array)
    const win = essentia.Windowing(vec, false, frameSize, 'hann')
    const spec = essentia.Spectrum(win.frame, frameSize)
    const spectrumArr = essentia.vectorToArray(spec.spectrum)
    try {
      brightness.push(clamp01(essentia.Centroid(spec.spectrum, nyquist).centroid / nyquist))
      flatness.push(clamp01(essentia.Flatness(spec.spectrum).flatness))
      bassRatio.push(
        clamp01(essentia.EnergyBandRatio(spec.spectrum, sampleRate, 20, 250).energyBandRatio),
      )
      flux.push(risingFlux(spectrumArr, prevSpectrum))
    } finally {
      vec.delete()
      win.frame.delete()
      spec.spectrum.delete()
    }
    prevSpectrum = spectrumArr
  }

  return { hopSec: frameSize / sampleRate, brightness, flatness, bassRatio, flux }
}

/** Fraction of spectral magnitude that rose since the previous frame (0–1). */
function risingFlux(spectrum: Float32Array, prev: Float32Array | null): number {
  if (!prev) return 0
  let rise = 0
  let total = 0
  for (let i = 0; i < spectrum.length; i++) {
    const d = spectrum[i]! - prev[i]!
    if (d > 0) rise += d
    total += spectrum[i]!
  }
  return total > 0 ? clamp01(rise / total) : 0
}

function meanInRange(values: number[], startFrame: number, endFrame: number): number {
  let sum = 0
  let n = 0
  for (let i = startFrame; i < endFrame && i < values.length; i++) {
    sum += values[i]!
    n++
  }
  return n > 0 ? sum / n : 0
}

/** Aggregate per-frame features over a time range into a section profile. */
export function profileForRange(
  feat: FrameSpectralFeatures,
  startSec: number,
  endSec: number,
): InstrumentationProfile {
  const s = Math.floor(startSec / feat.hopSec)
  const e = Math.max(s + 1, Math.floor(endSec / feat.hopSec))
  return {
    percussiveness: meanInRange(feat.flux, s, e),
    bassWeight: meanInRange(feat.bassRatio, s, e),
    brightness: meanInRange(feat.brightness, s, e),
    density: meanInRange(feat.flatness, s, e),
  }
}
