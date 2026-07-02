import { describe, expect, it } from 'vitest'
import { toCamelot } from '@/analysis/camelot'

describe('toCamelot', () => {
  // Canonical Camelot wheel: all 24 keys.
  const major: Record<string, string> = {
    C: '8B',
    'C#': '3B',
    D: '10B',
    Eb: '5B',
    E: '12B',
    F: '7B',
    'F#': '2B',
    G: '9B',
    Ab: '4B',
    A: '11B',
    Bb: '6B',
    B: '1B',
  }
  const minor: Record<string, string> = {
    C: '5A',
    'C#': '12A',
    D: '7A',
    Eb: '2A',
    E: '9A',
    F: '4A',
    'F#': '11A',
    G: '6A',
    Ab: '1A',
    A: '8A',
    Bb: '3A',
    B: '10A',
  }

  it('maps all 12 major keys', () => {
    for (const [key, code] of Object.entries(major)) {
      expect(toCamelot(key, 'major')).toBe(code)
    }
  })

  it('maps all 12 minor keys', () => {
    for (const [key, code] of Object.entries(minor)) {
      expect(toCamelot(key, 'minor')).toBe(code)
    }
  })

  it('handles enharmonic spellings', () => {
    expect(toCamelot('Db', 'major')).toBe(toCamelot('C#', 'major'))
    expect(toCamelot('G#', 'minor')).toBe(toCamelot('Ab', 'minor'))
  })

  it('returns empty for an unknown note', () => {
    expect(toCamelot('H', 'major')).toBe('')
  })
})
