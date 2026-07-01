import { afterEach, describe, expect, it } from 'vitest'
import { AnalysisWorkerPool } from '@/analysis/worker-pool'
import { downmixToMono } from '@/analysis/dsp'
import { makeWavSine } from '@/test/wav-fixture'

// End-to-end proof of the analysis path (plan Chunk 1.3): a real encoded WAV is
// decoded via OfflineAudioContext, downmixed, and its RMS computed inside a
// Comlink-wrapped worker running Essentia WASM — all in a real browser.

let pool: AnalysisWorkerPool | undefined

afterEach(() => {
  pool?.terminate()
  pool = undefined
})

async function decodeToChannels(wav: ArrayBuffer): Promise<Float32Array[]> {
  const ctx = new OfflineAudioContext(1, 1, 44100)
  const audio = await ctx.decodeAudioData(wav)
  return Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c))
}

describe('AnalysisWorkerPool (browser)', () => {
  it('decodes a WAV and computes RMS via a worker', async () => {
    const wav = makeWavSine({ freq: 440, amplitude: 0.5, seconds: 1 })
    const mono = downmixToMono(await decodeToChannels(wav))

    pool = new AnalysisWorkerPool(2)
    const workerRms = await pool.run((api) => api.computeRms(mono))

    // Sine of amplitude 0.5 → RMS = 0.5 / sqrt(2) ≈ 0.3536.
    expect(workerRms).toBeCloseTo(0.5 * Math.SQRT1_2, 2)
  })

  it('reports the Essentia version from the worker', async () => {
    pool = new AnalysisWorkerPool(1)
    expect(typeof (await pool.run((api) => api.version()))).toBe('string')
  })

  it('runs more jobs than workers by queueing', async () => {
    const mono = downmixToMono(await decodeToChannels(makeWavSine({ amplitude: 0.5 })))
    pool = new AnalysisWorkerPool(2)

    const results = await Promise.all(
      Array.from({ length: 6 }, () => pool!.run((api) => api.computeRms(mono))),
    )

    expect(results).toHaveLength(6)
    for (const r of results) expect(r).toBeCloseTo(0.5 * Math.SQRT1_2, 2)
  })
})
