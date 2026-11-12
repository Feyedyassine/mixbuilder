import { describe, expect, it } from 'vitest'
import { CAMELOT_KEYS, compatibleMoves, isCamelotCode, parseCamelot } from '@/tools/camelot'
import { toCamelot } from '@/analysis/camelot'

const moves = (code: string) =>
  Object.fromEntries(compatibleMoves(code).map((m) => [m.kind, m.code]))

describe('Camelot reference data', () => {
  it('has all 24 keys', () => {
    expect(Object.keys(CAMELOT_KEYS)).toHaveLength(24)
  })

  it('names agree with the analysis mapping (key → code)', () => {
    const plain = (s: string) => s.replace('♭', 'b').replace('♯', '#')
    for (const [code, { short }] of Object.entries(CAMELOT_KEYS)) {
      const minor = short.endsWith('m')
      const note = plain(minor ? short.slice(0, -1) : short)
      expect(toCamelot(note, minor ? 'minor' : 'major'), `${code} = ${short}`).toBe(code)
    }
  })

  it('validates codes', () => {
    expect(isCamelotCode('8A')).toBe(true)
    expect(isCamelotCode('13A')).toBe(false)
    expect(isCamelotCode('toString')).toBe(false)
    expect(parseCamelot(' 12b ')).toEqual({ number: 12, letter: 'B' })
    expect(parseCamelot('0A')).toBeNull()
  })
})

describe('compatibleMoves', () => {
  it('gives the classic moves for a minor key', () => {
    expect(moves('8A')).toEqual({
      same: '8A',
      up: '9A',
      down: '7A',
      relative: '8B',
      diagonal: '9B',
      jump: '10A',
      semitone: '3A',
    })
  })

  it('goes diagonally down into minor from a major key', () => {
    expect(moves('8B')).toMatchObject({ relative: '8A', diagonal: '7A' })
  })

  it('wraps around 12 → 1 and 1 → 12', () => {
    expect(moves('12A')).toMatchObject({ up: '1A', jump: '2A', diagonal: '1B' })
    expect(moves('1B')).toMatchObject({ down: '12B', diagonal: '12A' })
  })

  it('+7 is one semitone up (A minor → B♭ minor)', () => {
    expect(CAMELOT_KEYS[moves('8A').semitone!]!.short).toBe('B♭m')
  })

  it('returns nothing for an invalid code', () => {
    expect(compatibleMoves('Z9')).toEqual([])
  })
})
