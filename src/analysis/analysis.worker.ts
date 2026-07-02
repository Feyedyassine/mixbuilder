import * as Comlink from 'comlink'
import Essentia from 'essentia.js/dist/essentia.js-core.es.js'
import { EssentiaAnalyzer } from './essentia-analyzer'
import type { TrackFeatures } from './feature-schema'

// One Essentia instance + analyzer per worker, initialized lazily on first use.
// The essentia.js imports are dynamic so Vite splits them into the worker chunk —
// they never land in the initial page bundle (analysis is lazy-loaded).
let analyzerPromise: Promise<{ essentia: Essentia; analyzer: EssentiaAnalyzer }> | null = null

async function getAnalyzer() {
  if (!analyzerPromise) {
    analyzerPromise = (async () => {
      const { EssentiaWASM } = await import('essentia.js/dist/essentia-wasm.es.js')
      const wasm =
        typeof EssentiaWASM === 'function'
          ? await (EssentiaWASM as () => Promise<unknown>)()
          : EssentiaWASM
      const essentia = new Essentia(wasm)
      return { essentia, analyzer: new EssentiaAnalyzer(essentia) }
    })()
  }
  return analyzerPromise
}

const api = {
  /** Load and instantiate the analysis engine. Optional — analyze() triggers it. */
  async init(): Promise<void> {
    await getAnalyzer()
  },

  /** Essentia version string; a cheap proof the WASM instance is live. */
  async version(): Promise<string> {
    return (await getAnalyzer()).essentia.version
  },

  /** Full per-track feature analysis of a mono signal. */
  async analyze(mono: Float32Array, sampleRate: number): Promise<TrackFeatures> {
    const { analyzer } = await getAnalyzer()
    return analyzer.analyze(mono, sampleRate)
  },

  /** Root mean square of a mono signal (kept as a lightweight smoke check). */
  async computeRms(channel: Float32Array): Promise<number> {
    const { essentia } = await getAnalyzer()
    const vec = essentia.arrayToVector(channel)
    try {
      return essentia.RMS(vec).rms
    } finally {
      vec.delete()
    }
  },
}

export type AnalysisWorkerApi = typeof api

Comlink.expose(api)
