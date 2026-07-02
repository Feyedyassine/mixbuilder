import { describe, expect, it } from 'vitest'
import { detectSpikes, energyCurve, energyScore } from '@/analysis/energy'

describe('energyCurve', () => {
  it('normalizes to a 0–1 peak', () => {
    // 2 s at 100 Hz: first second quiet, second second loud.
    const sr = 100
    const mono = new Float32Array(sr * 2)
    for (let i = 0; i < sr; i++) mono[i] = 0.1
    for (let i = sr; i < sr * 2; i++) mono[i] = 1.0
    const { curve } = energyCurve(mono, sr, 1)
    expect(curve).toHaveLength(2)
    expect(Math.max(...curve)).toBeCloseTo(1, 5)
    expect(curve[0]!).toBeCloseTo(0.1, 5)
  })

  it('returns all-zero for silence', () => {
    const { curve } = energyCurve(new Float32Array(1000), 1000, 0.1)
    expect(curve.every((v) => v === 0)).toBe(true)
  })
})

describe('energyScore', () => {
  it('rates a loud signal high and a quiet one low', () => {
    const loud = new Float32Array(1000).fill(0.7) // ≈ −3 dBFS
    const quiet = new Float32Array(1000).fill(0.01) // ≈ −40 dBFS
    expect(energyScore(loud)).toBeGreaterThan(8)
    expect(energyScore(quiet)).toBe(1)
  })

  it('is 1 for silence', () => {
    expect(energyScore(new Float32Array(100))).toBe(1)
  })
})

describe('detectSpikes', () => {
  it('finds a sharp rise into a high level', () => {
    const curve = [0.1, 0.1, 0.1, 0.9, 0.9] // jump at index 3
    expect(detectSpikes(curve, 1, { minGapSec: 1 })).toEqual([3])
  })

  it('honors the refractory gap', () => {
    // Second rise at index 3 is only 2 frames after the first — suppressed by a
    // 3-frame gap.
    const curve = [0, 0.9, 0.2, 0.9]
    expect(detectSpikes(curve, 1, { minGapSec: 3 })).toEqual([1])
  })

  it('ignores gentle rises', () => {
    const curve = [0.1, 0.2, 0.3, 0.4, 0.5]
    expect(detectSpikes(curve, 1)).toEqual([])
  })
})
