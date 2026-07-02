import { describe, expect, it } from 'vitest'
import { tagsFromFilename } from '@/ingestion/tags'

describe('tagsFromFilename', () => {
  it('splits the "Artist - Title" convention', () => {
    expect(tagsFromFilename('Bicep - Glue.flac')).toEqual({
      artist: 'Bicep',
      title: 'Glue',
    })
  })

  it('uses the whole stem as title when there is no separator', () => {
    expect(tagsFromFilename('untitled_bounce.wav')).toEqual({ title: 'untitled_bounce' })
  })

  it('does not split on a bare hyphen without surrounding spaces', () => {
    expect(tagsFromFilename('re-up.mp3')).toEqual({ title: 're-up' })
  })

  it('strips only the extension', () => {
    expect(tagsFromFilename('a.remix.v2.m4a')).toEqual({ title: 'a.remix.v2' })
  })
})
