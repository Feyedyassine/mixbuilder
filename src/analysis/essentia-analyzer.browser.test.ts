import { afterEach, describe, expect, it } from 'vitest'
import { AnalysisWorkerPool } from '@/analysis/worker-pool'
import { FEATURE_SCHEMA_VERSION } from '@/analysis/feature-schema'

// Full analysis path through the worker (plan Chunk 2.2). Uses a synthetic
// four-on-the-floor kick so beat tracking has something real to lock onto.
// Precise accuracy is Chunk 2.4's job (real tracks + ground truth); here we
// assert well-formed output, determinism, and a plausible tempo.

const SR = 44100

function kickPattern(bpm: number, seconds: number, sampleRate = SR): Float32Array {
  const n = Math.floor(seconds * sampleRate)
  const mono = new Float32Array(n)
  const beatSamples = Math.round((60 / bpm) * sampleRate)
  const burstLen = Math.round(0.06 * sampleRate)
  for (let start = 0; start < n; start += beatSamples) {
    for (let i = 0; i < burstLen && start + i < n; i++) {
      const env = Math.exp(-i / (sampleRate * 0.03))
      mono[start + i]! += env * Math.sin((2 * Math.PI * 60 * i) / sampleRate)
    }
  }
  return mono
}

let pool: AnalysisWorkerPool | undefined
afterEach(() => {
  pool?.terminate()
  pool = undefined
})

describe('EssentiaAnalyzer via worker (browser)', () => {
  it('produces well-formed feature JSON', async () => {
    pool = new AnalysisWorkerPool(1)
    const mono = kickPattern(120, 10)
    const f = await pool.run((api) => api.analyze(mono, SR))

    expect(f.schemaVersion).toBe(FEATURE_SCHEMA_VERSION)
    expect(f.sampleRate).toBe(SR)
    expect(f.durationSec).toBeCloseTo(10, 1)

    expect(f.tempo.bpm).toBeGreaterThan(0)
    expect(f.tempo.confidence).toBeGreaterThanOrEqual(0)
    expect(f.tempo.confidence).toBeLessThanOrEqual(1)
    expect(f.tempo.beatsSec.length).toBeGreaterThan(0)
    expect(f.tempo.alternates).toHaveLength(2)

    expect(typeof f.key.key).toBe('string')
    expect(['major', 'minor']).toContain(f.key.scale)
    expect(f.key.camelot).toMatch(/^(\d{1,2}[AB])?$/)

    expect(f.energy.curve.length).toBeGreaterThan(0)
    expect(Math.max(...f.energy.curve)).toBeLessThanOrEqual(1)
    expect(f.energy.score).toBeGreaterThanOrEqual(1)
    expect(f.energy.score).toBeLessThanOrEqual(10)
    expect(Array.isArray(f.spikesSec)).toBe(true)
  })

  it('tracks a plausible tempo (120 BPM or its octave)', async () => {
    pool = new AnalysisWorkerPool(1)
    const f = await pool.run((api) => api.analyze(kickPattern(120, 12), SR))
    const nearAnOctave = [60, 120, 240].some((t) => Math.abs(f.tempo.bpm - t) < 8)
    expect(nearAnOctave).toBe(true)
  })

  it('is stable across runs (BPM ~repeatable, energy/key exact)', async () => {
    // Essentia's RhythmExtractor2013 (multifeature) is not bit-deterministic —
    // it can vary ~1 BPM between runs — so BPM is asserted approximately. The
    // pure-DSP energy score and the key extraction are exactly repeatable.
    pool = new AnalysisWorkerPool(1)
    const mono = kickPattern(128, 8)
    const a = await pool.run((api) => api.analyze(mono, SR))
    const b = await pool.run((api) => api.analyze(mono, SR))
    expect(Math.abs(b.tempo.bpm - a.tempo.bpm)).toBeLessThan(3)
    expect(b.key.camelot).toBe(a.key.camelot)
    expect(b.energy.score).toBe(a.energy.score)
  })
})
