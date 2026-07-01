// Pure DSP helpers. No WASM, no Web Audio — deterministic and Node-testable.
// These run on the main thread or inside the worker before handing off to Essentia.

/**
 * Downmix N channels to mono by averaging. Returns the input directly when already
 * mono. All channels must share the same length (guaranteed by decodeAudioData).
 */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0)
  const first = channels[0]!
  if (channels.length === 1) return first

  const length = first.length
  const mono = new Float32Array(length)
  for (const channel of channels) {
    for (let i = 0; i < length; i++) {
      mono[i]! += channel[i]!
    }
  }
  const inv = 1 / channels.length
  for (let i = 0; i < length; i++) {
    mono[i]! *= inv
  }
  return mono
}

/**
 * Root mean square of a signal. Reference implementation used for unit tests and
 * as a WASM-free fallback; the worker path computes the same via Essentia.
 */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!
    sum += s * s
  }
  return Math.sqrt(sum / samples.length)
}
