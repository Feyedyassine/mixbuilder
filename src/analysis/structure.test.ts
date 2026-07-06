import { describe, expect, it } from 'vitest'
import { segmentStructure } from '@/analysis/structure'

// Build an energy curve (hopSec = 1) from labeled level blocks.
function curveFromBlocks(blocks: { level: number; sec: number }[]): number[] {
  const curve: number[] = []
  for (const { level, sec } of blocks) {
    for (let i = 0; i < sec; i++) curve.push(level)
  }
  return curve
}

describe('segmentStructure', () => {
  it('finds intro/drop/breakdown/.../outro on a structured curve', () => {
    // quiet intro → loud → quiet breakdown → loud → quiet outro, 40s each block.
    const blocks = [
      { level: 0.1, sec: 40 },
      { level: 1.0, sec: 40 },
      { level: 0.15, sec: 40 },
      { level: 1.0, sec: 40 },
      { level: 0.1, sec: 40 },
    ]
    const curve = curveFromBlocks(blocks)
    const spans = segmentStructure(curve, 1, [], 200, { minSectionSec: 10 })

    expect(spans.length).toBeGreaterThanOrEqual(4)
    expect(spans[0]!.label).toBe('intro')
    expect(spans[spans.length - 1]!.label).toBe('outro')
    // Sections cover the track contiguously start→end.
    expect(spans[0]!.startSec).toBe(0)
    expect(spans[spans.length - 1]!.endSec).toBe(200)
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i]!.startSec).toBe(spans[i - 1]!.endSec)
    }
    // At least one high-energy drop was detected.
    expect(spans.some((s) => s.label === 'drop')).toBe(true)
  })

  it('snaps boundaries to the beat grid', () => {
    const curve = curveFromBlocks([
      { level: 0.1, sec: 40 },
      { level: 1.0, sec: 40 },
      { level: 0.1, sec: 40 },
    ])
    // Beats every 2s; boundaries must land on beats.
    const beats = Array.from({ length: 60 }, (_, i) => i * 2)
    const spans = segmentStructure(curve, 1, beats, 120, { minSectionSec: 10 })
    for (const s of spans.slice(1)) {
      expect(s.startSec % 2).toBe(0)
    }
  })

  it('degrades to intro/body/outro on a flat track', () => {
    const curve = new Array<number>(120).fill(0.5)
    const spans = segmentStructure(curve, 1, [], 120)
    expect(spans).toHaveLength(3)
    expect(spans.map((s) => s.label)).toEqual(['intro', expect.any(String), 'outro'])
  })

  it('trims a trailing silence so the outro ends at the musical end', () => {
    // intro → drop → breakdown → drop → 30s of silence at the end.
    const curve = curveFromBlocks([
      { level: 0.1, sec: 30 },
      { level: 1.0, sec: 40 },
      { level: 0.15, sec: 30 },
      { level: 1.0, sec: 40 },
      { level: 0.0, sec: 30 },
    ])
    const spans = segmentStructure(curve, 1, [], 170, { minSectionSec: 10 })
    const last = spans[spans.length - 1]!
    expect(last.label).toBe('outro')
    // Music ends ~140s; the 30s silence must be trimmed, not called the outro.
    expect(last.endSec).toBeGreaterThan(130)
    expect(last.endSec).toBeLessThan(150)
  })

  it('trims a reverb tail (energy present but no beats after the music stops)', () => {
    // 100s of music with beats, then a 20s reverb tail with energy but no beats.
    const curve = curveFromBlocks([
      { level: 0.5, sec: 100 },
      { level: 0.3, sec: 20 },
    ])
    const beats = Array.from({ length: 100 }, (_, i) => i) // beats only during the music
    const spans = segmentStructure(curve, 1, beats, 120, { minSectionSec: 10 })
    const last = spans[spans.length - 1]!
    expect(last.label).toBe('outro')
    // The reverb tail (beatless decay) should be trimmed to ~the last beat.
    expect(last.endSec).toBeLessThan(110)
  })

  it('handles degenerate tiny input without throwing', () => {
    const spans = segmentStructure([0.5], 1, [], 1)
    expect(spans.length).toBeGreaterThanOrEqual(1)
    expect(spans[0]!.startSec).toBe(0)
  })
})
