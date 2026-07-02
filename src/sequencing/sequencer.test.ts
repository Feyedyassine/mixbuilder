import { describe, expect, it } from 'vitest'
import { optimizeSet, type AnalyzedTrack } from '@/sequencing/sequencer'
import { makeTrack } from '@/sequencing/fixtures'

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CAMELOTS = ['8A', '9A', '7A', '8B', '10A', '5A', '2B', '4A']

function genTracks(n: number, seed: number): AnalyzedTrack[] {
  const r = rng(seed)
  const pick = <T>(arr: T[]) => arr[Math.floor(r() * arr.length)]!
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    features: makeTrack({
      bpm: 120 + Math.floor(r() * 12),
      camelot: pick(CAMELOTS),
      intro: { energy: r(), brightness: r(), density: r(), percussiveness: r(), bassWeight: r() },
      outro: { energy: r(), brightness: r(), density: r(), percussiveness: r(), bassWeight: r() },
    }),
  }))
}

describe('optimizeSet — anchors', () => {
  it('pins the start and end tracks', () => {
    const tracks = genTracks(10, 1)
    const set = optimizeSet(tracks, { startId: 't3', endId: 't7', seed: 5 })
    expect(set.order[0]!.id).toBe('t3')
    expect(set.order.at(-1)!.id).toBe('t7')
    expect(set.order).toHaveLength(10)
    expect(new Set(set.order.map((t) => t.id)).size).toBe(10) // no dup/drop
  })
})

describe('optimizeSet — quality', () => {
  it('beats the greedy baseline across seeded playlists', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const tracks = genTracks(12, seed)
      const greedy = optimizeSet(tracks, { seed, iterations: 0 })
      const annealed = optimizeSet(tracks, { seed, iterations: 4000 })
      expect(annealed.objectiveScore).toBeGreaterThanOrEqual(greedy.objectiveScore - 1e-9)
    }
  })

  it('is deterministic for a given seed', () => {
    const tracks = genTracks(15, 99)
    const a = optimizeSet(tracks, { seed: 42 })
    const b = optimizeSet(tracks, { seed: 42 })
    expect(b.order.map((t) => t.id)).toEqual(a.order.map((t) => t.id))
  })
})

describe('optimizeSet — anti-monotony', () => {
  it('avoids long same-key runs when monotony is weighted', () => {
    // 6 tracks, two keys, otherwise identical → only monotony distinguishes orders.
    const tracks: AnalyzedTrack[] = [
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `a${i}`,
        features: makeTrack({ camelot: '8A' }),
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `b${i}`,
        features: makeTrack({ camelot: '9A' }),
      })),
    ]
    const set = optimizeSet(tracks, {
      seed: 3,
      objectiveWeights: { transition: 1, arc: 0, monotony: 3 },
    })
    let maxRun = 1
    let run = 1
    const codes = set.order.map((t) => t.features.key.camelot)
    for (let i = 1; i < codes.length; i++) {
      run = codes[i] === codes[i - 1] ? run + 1 : 1
      maxRun = Math.max(maxRun, run)
    }
    expect(maxRun).toBeLessThan(3)
  })
})

describe('optimizeSet — output & scale', () => {
  it('assembles transitions with mix points and warnings', () => {
    const set = optimizeSet(genTracks(6, 7))
    expect(set.transitions).toHaveLength(5)
    for (const tr of set.transitions) {
      expect(tr.mixPoint.fromEndSec).toBeGreaterThan(tr.mixPoint.fromStartSec)
      expect(tr.mixPoint.toEndSec).toBeGreaterThan(tr.mixPoint.toStartSec)
      expect(Array.isArray(tr.warnings)).toBe(true)
    }
    expect(set.totalScore).toBeGreaterThanOrEqual(0)
    expect(set.totalScore).toBeLessThanOrEqual(1)
  })

  it('handles 100 tracks and keeps them all', () => {
    const tracks = genTracks(100, 11)
    const set = optimizeSet(tracks, { seed: 1 })
    expect(set.order).toHaveLength(100)
    expect(new Set(set.order.map((t) => t.id)).size).toBe(100)
  })

  it('handles trivial inputs', () => {
    expect(optimizeSet([]).order).toHaveLength(0)
    expect(optimizeSet(genTracks(1, 1)).order).toHaveLength(1)
  })
})
