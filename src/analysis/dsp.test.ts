import { describe, expect, it } from 'vitest'
import { downmixToMono, rms } from '@/analysis/dsp'

describe('downmixToMono', () => {
  it('returns the single channel unchanged for mono input', () => {
    const ch = new Float32Array([0.1, -0.2, 0.3])
    expect(downmixToMono([ch])).toBe(ch)
  })

  it('averages stereo channels sample-wise', () => {
    const left = new Float32Array([1, 0, -1, 0.5])
    const right = new Float32Array([0, 0, 1, -0.5])
    expect(Array.from(downmixToMono([left, right]))).toEqual([0.5, 0, 0, 0])
  })

  it('returns empty for no channels', () => {
    expect(downmixToMono([]).length).toBe(0)
  })
})

describe('rms', () => {
  it('is |c| for a constant signal', () => {
    expect(rms(new Float32Array(512).fill(0.5))).toBeCloseTo(0.5, 6)
  })

  it('is amplitude/sqrt(2) for a sine', () => {
    const n = 4096
    const sine = new Float32Array(n)
    for (let i = 0; i < n; i++) sine[i] = 0.8 * Math.sin((2 * Math.PI * 60 * i) / n)
    expect(rms(sine)).toBeCloseTo(0.8 * Math.SQRT1_2, 3)
  })

  it('is 0 for an empty signal', () => {
    expect(rms(new Float32Array(0))).toBe(0)
  })
})
