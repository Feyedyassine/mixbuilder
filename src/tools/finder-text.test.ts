import { describe, expect, it } from 'vitest'
import { finderResultsText } from '@/tools/finder-text'

describe('finderResultsText', () => {
  it('formats one line per track with key and rounded BPM', () => {
    expect(
      finderResultsText([
        { title: 'Glue', artist: 'Bicep', camelot: '8A', musicalKey: 'Am', bpm: 123.6 },
        { title: 'untitled.wav', camelot: '9B', musicalKey: '', bpm: 126 },
      ]),
    ).toBe('Bicep – Glue — 8A (Am), 124 BPM\nuntitled.wav — 9B, 126 BPM')
  })

  it('returns an empty string for no tracks', () => {
    expect(finderResultsText([])).toBe('')
  })
})
