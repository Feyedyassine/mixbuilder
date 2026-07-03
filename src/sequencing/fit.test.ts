import { describe, expect, it } from 'vitest'
import { computeFits } from '@/sequencing/fit'
import { makeTrack } from '@/sequencing/fixtures'
import { optimizeSet, type AnalyzedTrack } from '@/sequencing/sequencer'

// A coherent tech-house-ish set: ~124 BPM, instrumental, moderate texture.
function techHouseSet(): AnalyzedTrack[] {
  const keys = ['8A', '9A', '7A', '8A', '9A', '10A']
  return keys.map((camelot, i) => ({
    id: `th${i}`,
    features: makeTrack({
      bpm: 123 + (i % 3),
      camelot,
      intro: { energy: 0.6, percussiveness: 0.7, bassWeight: 0.6, brightness: 0.5, density: 0.6 },
      outro: { energy: 0.6, percussiveness: 0.7, bassWeight: 0.6, brightness: 0.5, density: 0.6 },
    }),
  }))
}

describe('computeFits', () => {
  it('does not flag coherent tracks', () => {
    const fits = computeFits(techHouseSet())
    expect(fits.every((f) => !f.isMisfit)).toBe(true)
  })

  it('flags an outlier with a plain-language, feature-based reason', () => {
    // Hip-hop-shaped outlier: ~88 BPM, vocal/bright, different texture.
    const set: AnalyzedTrack[] = [
      ...techHouseSet(),
      {
        id: 'outlier',
        features: makeTrack({
          bpm: 88,
          camelot: '2B',
          intro: {
            energy: 0.5,
            percussiveness: 0.3,
            bassWeight: 0.9,
            brightness: 0.9,
            density: 0.3,
          },
          outro: {
            energy: 0.5,
            percussiveness: 0.3,
            bassWeight: 0.9,
            brightness: 0.9,
            density: 0.3,
          },
        }),
      },
    ]
    const outlier = computeFits(set).find((f) => f.id === 'outlier')!
    expect(outlier.isMisfit).toBe(true)
    expect(outlier.reasons.length).toBeGreaterThan(0)
    // Mentions the tempo gap in plain language…
    expect(outlier.reasons.join(' ')).toMatch(/88 BPM vs set median/)
    // …and never uses a genre label.
    expect(outlier.reasons.join(' ').toLowerCase()).not.toMatch(/hip.?hop|techno|house|genre/)
  })

  it('suggests a half/double-time bridge for a tempo outlier', () => {
    const set: AnalyzedTrack[] = [
      ...techHouseSet(),
      {
        id: 'half',
        features: makeTrack({
          bpm: 62,
          camelot: '2B',
          intro: { brightness: 0.95 },
          outro: { brightness: 0.95 },
        }),
      },
    ]
    const half = computeFits(set).find((f) => f.id === 'half')!
    expect(half.isMisfit).toBe(true)
    expect(half.bridge).toMatch(/double-time/)
  })
})

describe('bench (exclusion from optimization)', () => {
  it('excludes benched tracks and keeps the rest', () => {
    const all = techHouseSet()
    const benched = new Set(['th2'])
    const active = all.filter((t) => !benched.has(t.id))
    const set = optimizeSet(active, { seed: 1 })
    expect(set.order.map((t) => t.id)).not.toContain('th2')
    expect(set.order).toHaveLength(all.length - 1)
  })
})
