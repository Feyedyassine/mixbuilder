import type { TrackFeatures } from './feature-schema'

/**
 * The analysis engine boundary. Anything downstream depends only on this
 * interface and the TrackFeatures shape it returns — never on Essentia directly —
 * so the engine can be swapped (Meyda, aubio-wasm, hand-rolled DSP) by providing
 * another implementation. `EssentiaAnalyzer` is the first one.
 */
export interface Analyzer {
  /** Analyze a mono signal (at `sampleRate`) into the versioned feature JSON. */
  analyze(mono: Float32Array, sampleRate: number): TrackFeatures
}
