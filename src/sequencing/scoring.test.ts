import { describe, expect, it } from 'vitest'
import { scoreTransition, type TermName } from '@/sequencing/scoring'
import { makeTrack } from '@/sequencing/fixtures'

function term(
  from: ReturnType<typeof makeTrack>,
  to: ReturnType<typeof makeTrack>,
  name: TermName,
) {
  return scoreTransition(from, to).terms.find((t) => t.term === name)!
}

describe('scoreTransition — key (Camelot)', () => {
  it('rates the same key perfectly', () => {
    expect(term(makeTrack({ camelot: '8A' }), makeTrack({ camelot: '8A' }), 'key').score).toBe(1)
  })
  it('rates relative major/minor highly', () => {
    expect(
      term(makeTrack({ camelot: '8A' }), makeTrack({ camelot: '8B' }), 'key').score,
    ).toBeCloseTo(0.9, 5)
  })
  it('rates adjacent wheel positions highly', () => {
    expect(
      term(makeTrack({ camelot: '8A' }), makeTrack({ camelot: '9A' }), 'key').score,
    ).toBeCloseTo(0.85, 5)
  })
  it('rates far keys poorly', () => {
    expect(
      term(makeTrack({ camelot: '8A' }), makeTrack({ camelot: '2A' }), 'key').score,
    ).toBeLessThan(0.3)
  })
  it('is unavailable when a camelot code is missing', () => {
    expect(term(makeTrack({ camelot: '' }), makeTrack({ camelot: '8A' }), 'key').available).toBe(
      false,
    )
  })
})

describe('scoreTransition — bpm', () => {
  it('rates equal tempo perfectly', () => {
    expect(term(makeTrack({ bpm: 128 }), makeTrack({ bpm: 128 }), 'bpm').score).toBe(1)
  })
  it('accepts half/double-time as compatible', () => {
    const t = term(makeTrack({ bpm: 128 }), makeTrack({ bpm: 64 }), 'bpm')
    expect(t.score).toBeGreaterThan(0.9)
    expect(t.note).toMatch(/time/)
  })
  it('rejects an incompatible tempo gap', () => {
    expect(term(makeTrack({ bpm: 128 }), makeTrack({ bpm: 100 }), 'bpm').score).toBe(0)
  })
})

describe('scoreTransition — section-aware terms', () => {
  it('penalizes bass conflict when both sections are bass-heavy', () => {
    const t = term(
      makeTrack({ outro: { bassWeight: 0.95 } }),
      makeTrack({ intro: { bassWeight: 0.95 } }),
      'bass',
    )
    expect(t.score).toBeLessThan(0.2)
    expect(t.note).toMatch(/conflict/i)
  })

  it('rewards smooth energy continuity', () => {
    const smooth = term(
      makeTrack({ outro: { energy: 0.6 } }),
      makeTrack({ intro: { energy: 0.6 } }),
      'energy',
    )
    const jump = term(
      makeTrack({ outro: { energy: 0.1 } }),
      makeTrack({ intro: { energy: 0.9 } }),
      'energy',
    )
    expect(smooth.score).toBeGreaterThan(jump.score)
  })

  it('activates the vocal term only when both sections have vocal presence', () => {
    expect(term(makeTrack(), makeTrack(), 'vocal').available).toBe(false)
    const clash = term(
      makeTrack({ outro: { vocalPresence: 0.9 } }),
      makeTrack({ intro: { vocalPresence: 0.9 } }),
      'vocal',
    )
    expect(clash.available).toBe(true)
    expect(clash.score).toBeLessThan(0.3)
  })
})

describe('scoreTransition — overall', () => {
  it('scores identical tracks very high', () => {
    expect(scoreTransition(makeTrack(), makeTrack()).total).toBeGreaterThan(0.9)
  })

  it('scores a planted clash very low', () => {
    const from = makeTrack({
      bpm: 128,
      camelot: '8B',
      outro: { energy: 0.9, bassWeight: 0.9, brightness: 0.9, density: 0.9, percussiveness: 0.9 },
    })
    const to = makeTrack({
      bpm: 98,
      camelot: '3A',
      intro: { energy: 0.1, bassWeight: 0.9, brightness: 0.1, density: 0.1, percussiveness: 0.1 },
    })
    expect(scoreTransition(from, to).total).toBeLessThan(0.3)
  })

  it('renormalizes so a missing term neither helps nor hurts', () => {
    // Same pair; adding neutral vocal presence (0) shouldn't move the total much.
    const base = scoreTransition(makeTrack(), makeTrack()).total
    const withVocal = scoreTransition(
      makeTrack({ outro: { vocalPresence: 0 } }),
      makeTrack({ intro: { vocalPresence: 0 } }),
    ).total
    expect(withVocal).toBeGreaterThanOrEqual(base - 0.02)
  })

  it('exposes every term with a human-readable note', () => {
    const { terms } = scoreTransition(makeTrack(), makeTrack())
    expect(terms).toHaveLength(7)
    for (const t of terms) expect(t.note.length).toBeGreaterThan(0)
  })
})

describe('scoreTransition — symmetry', () => {
  const a = makeTrack({ bpm: 128, camelot: '8A', outro: { energy: 0.2 }, intro: { energy: 0.5 } })
  const b = makeTrack({ bpm: 130, camelot: '9A', outro: { energy: 0.5 }, intro: { energy: 0.9 } })

  it('key and bpm terms are direction-independent', () => {
    expect(term(a, b, 'key').score).toBe(term(b, a, 'key').score)
    expect(term(a, b, 'bpm').score).toBe(term(b, a, 'bpm').score)
  })

  it('section-aware terms are directional', () => {
    // a.outro(0.2)→b.intro(0.9) vs b.outro(0.5)→a.intro(0.5): different by design.
    expect(term(a, b, 'energy').score).not.toBe(term(b, a, 'energy').score)
  })
})
