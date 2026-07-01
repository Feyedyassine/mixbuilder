import * as Comlink from 'comlink'
import Essentia from 'essentia.js/dist/essentia.js-core.es.js'

// One Essentia instance per worker, initialized lazily on first use. The essentia.js
// imports are dynamic so Vite splits them into the worker chunk — they never land in
// the initial page bundle (analysis is lazy-loaded, per plan Chunk 1.3).
let essentiaPromise: Promise<Essentia> | null = null

async function getEssentia(): Promise<Essentia> {
  if (!essentiaPromise) {
    essentiaPromise = (async () => {
      const { EssentiaWASM } = await import('essentia.js/dist/essentia-wasm.es.js')
      const wasm =
        typeof EssentiaWASM === 'function'
          ? await (EssentiaWASM as () => Promise<unknown>)()
          : EssentiaWASM
      return new Essentia(wasm)
    })()
  }
  return essentiaPromise
}

const api = {
  /** Load and instantiate Essentia. Optional — computeRms triggers it lazily too. */
  async init(): Promise<void> {
    await getEssentia()
  },

  /** Essentia version string; also a cheap proof the WASM instance is live. */
  async version(): Promise<string> {
    return (await getEssentia()).version
  },

  /** Root mean square of a mono signal, computed in-WASM. */
  async computeRms(channel: Float32Array): Promise<number> {
    const essentia = await getEssentia()
    const { rms } = essentia.RMS(essentia.arrayToVector(channel))
    return rms
  },
}

export type AnalysisWorkerApi = typeof api

Comlink.expose(api)
