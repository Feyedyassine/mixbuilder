import * as Comlink from 'comlink'
import { AnalysisWorkerPool } from './worker-pool'
import { decodeToMono } from './decode'
import type { TrackFeatures } from './feature-schema'

// Shared analysis entry point for the app: decode on the main thread, then hand
// the mono signal to the worker pool. The pool (and its WASM) is created lazily
// on first analysis so it stays out of initial load.

let pool: AnalysisWorkerPool | null = null

function getPool(): AnalysisWorkerPool {
  if (!pool) pool = new AnalysisWorkerPool()
  return pool
}

/**
 * Decode and fully analyze one audio file into feature JSON. The mono buffer is
 * transferred (zero-copy) to the worker rather than cloned — tracks are tens of
 * MB of samples.
 */
export async function analyzeAudioFile(file: File): Promise<TrackFeatures> {
  const { mono, sampleRate } = await decodeToMono(await file.arrayBuffer())
  return getPool().run((api) => api.analyze(Comlink.transfer(mono, [mono.buffer]), sampleRate))
}

/** Tear down the worker pool (e.g. on unmount). */
export function disposeAnalysisPool(): void {
  pool?.terminate()
  pool = null
}
