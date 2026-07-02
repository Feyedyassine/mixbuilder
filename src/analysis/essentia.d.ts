// Minimal type surface for the essentia.js ES builds we use. The package ships a
// large generated core_api.d.ts but does not map it to these deep import paths,
// so we declare only what the analysis code touches.

declare module 'essentia.js/dist/essentia-wasm.es.js' {
  // Emscripten module: either the module object directly or a factory returning it.
  export const EssentiaWASM: unknown
}

declare module 'essentia.js/dist/essentia.js-core.es.js' {
  /** A std::vector<float> living in the WASM heap; must be .delete()d after use. */
  export interface EssentiaVector {
    delete(): void
    size(): number
  }

  export interface RhythmResult {
    bpm: number
    ticks: EssentiaVector
    confidence: number
    estimates: EssentiaVector
    bpmIntervals: EssentiaVector
  }

  export interface KeyResult {
    key: string
    scale: string
    strength: number
  }

  export default class Essentia {
    constructor(wasm: unknown, isDebug?: boolean)
    version: string
    algorithmNames: string
    arrayToVector(array: Float32Array): EssentiaVector
    vectorToArray(vector: EssentiaVector): Float32Array
    RMS(signal: EssentiaVector): { rms: number }
    RhythmExtractor2013(
      signal: EssentiaVector,
      maxTempo?: number,
      method?: string,
      minTempo?: number,
    ): RhythmResult
    KeyExtractor(
      audio: EssentiaVector,
      averageDetuningCorrection?: boolean,
      frameSize?: number,
      hopSize?: number,
      hpcpSize?: number,
      maxFrequency?: number,
      maximumSpectralPeaks?: number,
      minFrequency?: number,
      pcpThreshold?: number,
      profileType?: string,
      sampleRate?: number,
    ): KeyResult
    delete(): void
  }
}
