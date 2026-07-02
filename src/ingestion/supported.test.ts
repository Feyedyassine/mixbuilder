import { describe, expect, it } from 'vitest'
import { fileExtension, isSupportedAudioFile } from '@/ingestion/supported'

describe('fileExtension', () => {
  it('extracts a lowercased extension', () => {
    expect(fileExtension('Track.FLAC')).toBe('.flac')
  })
  it('handles dotted names', () => {
    expect(fileExtension('a.remix.v2.mp3')).toBe('.mp3')
  })
  it('returns empty when there is no extension', () => {
    expect(fileExtension('noext')).toBe('')
  })
})

describe('isSupportedAudioFile', () => {
  it('accepts supported extensions regardless of missing MIME', () => {
    for (const name of ['a.mp3', 'b.wav', 'c.flac', 'd.m4a', 'e.aac']) {
      expect(isSupportedAudioFile({ name })).toBe(true)
    }
  })

  it('accepts by MIME when the extension is unknown', () => {
    expect(isSupportedAudioFile({ name: 'track', type: 'audio/mpeg' })).toBe(true)
  })

  it('rejects unsupported files', () => {
    expect(isSupportedAudioFile({ name: 'cover.jpg', type: 'image/jpeg' })).toBe(false)
    expect(isSupportedAudioFile({ name: 'notes.txt' })).toBe(false)
    expect(isSupportedAudioFile({ name: 'video.mp4', type: 'video/mp4' })).toBe(false)
  })
})
