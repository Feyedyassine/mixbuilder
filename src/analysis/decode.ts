import { downmixToMono } from './dsp'

// Decoding uses the Web Audio API, which is main-thread only (workers have no
// AudioContext). So the main thread decodes + downmixes, then transfers the mono
// Float32Array to a worker for analysis.

/**
 * Essentia's rhythm/loudness algorithms assume 44.1 kHz, so we decode at that
 * rate for consistent, comparable results across files.
 */
export const ANALYSIS_SAMPLE_RATE = 44100

export interface DecodedAudio {
  mono: Float32Array
  sampleRate: number
  durationSec: number
}

/**
 * Decode encoded audio bytes to a mono signal at the analysis sample rate.
 * `decodeAudioData` resamples to the OfflineAudioContext's rate.
 */
export async function decodeToMono(
  data: ArrayBuffer,
  sampleRate: number = ANALYSIS_SAMPLE_RATE,
): Promise<DecodedAudio> {
  const ctx = new OfflineAudioContext(1, 1, sampleRate)
  const buffer = await ctx.decodeAudioData(data)
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c),
  )
  return {
    mono: downmixToMono(channels),
    sampleRate: buffer.sampleRate,
    durationSec: buffer.duration,
  }
}
