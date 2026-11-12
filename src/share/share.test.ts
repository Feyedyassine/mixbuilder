import { describe, expect, it } from 'vitest'
import { parseSharedSet, type SharedSet } from '@/share/schema'
import { buildSharedSet, tracklistText } from '@/share/build'
import { sequenceInOrder, type AnalyzedTrack } from '@/sequencing/sequencer'
import { makeTrack } from '@/sequencing/fixtures'
import type { TrackDisplay } from '@/export/build'

const hash = (c: string) => c.repeat(64)

const valid = (): SharedSet => ({
  version: 1,
  name: 'Friday',
  arc: 'journey',
  flow: 0.8,
  transitions: [0.75],
  tracks: [
    { hash: hash('a'), title: 'One', artist: 'X', bpm: 124, camelot: '8A', energy: 6.5 },
    { hash: hash('b'), title: 'Two', bpm: 126, camelot: '12B', energy: 7 },
  ],
})

describe('parseSharedSet', () => {
  it('accepts a valid set and strips unknown fields', () => {
    const input = {
      ...valid(),
      extra: 'x',
      tracks: valid().tracks.map((t) => ({ ...t, path: '/x' })),
    }
    const parsed = parseSharedSet(input)
    expect(parsed).toEqual(valid())
    expect(parsed).not.toHaveProperty('extra')
    expect(parsed!.tracks[0]).not.toHaveProperty('path')
  })

  it('trims text fields', () => {
    expect(parseSharedSet({ ...valid(), name: '  Friday  ' })?.name).toBe('Friday')
  })

  it.each([
    ['wrong version', { version: 2 }],
    ['empty name', { name: '   ' }],
    ['long name', { name: 'x'.repeat(81) }],
    ['unknown arc', { arc: 'rollercoaster' }],
    ['inherited property as arc', { arc: 'toString' }],
    ['prototype key as arc', { arc: '__proto__' }],
    ['flow out of range', { flow: 1.5 }],
    ['transition count mismatch', { transitions: [] }],
    ['transition out of range', { transitions: [2] }],
    ['single track', { tracks: [valid().tracks[0]], transitions: [] }],
  ])('rejects %s', (_label, patch) => {
    expect(parseSharedSet({ ...valid(), ...patch })).toBeNull()
  })

  it.each([
    ['bad hash', { hash: 'not-a-hash' }],
    ['bad camelot', { camelot: '13A' }],
    ['bpm too high', { bpm: 400 }],
    ['NaN energy', { energy: Number.NaN }],
    ['empty title', { title: '' }],
    ['non-string artist', { artist: 42 }],
  ])('rejects a track with %s', (_label, patch) => {
    const set = valid()
    expect(
      parseSharedSet({ ...set, tracks: [{ ...set.tracks[0], ...patch }, set.tracks[1]] }),
    ).toBeNull()
  })

  it('rejects non-objects', () => {
    expect(parseSharedSet(null)).toBeNull()
    expect(parseSharedSet('set')).toBeNull()
  })
})

describe('buildSharedSet', () => {
  const tracks: AnalyzedTrack[] = [
    { id: hash('1'), features: makeTrack({ bpm: 124, camelot: '8A' }) },
    { id: hash('2'), features: makeTrack({ bpm: 300, camelot: '9A' }) },
    { id: hash('3'), features: makeTrack({ bpm: 126, camelot: '9B' }) },
  ]
  const set = sequenceInOrder(tracks, { arc: 'warmup' })
  const display = new Map<string, TrackDisplay>([
    [hash('1'), { fileName: 'one.mp3', title: 'One', artist: 'X' }],
    [hash('2'), { fileName: 'two.mp3', title: '' }],
  ])

  it('always produces a payload the server accepts', () => {
    const shared = buildSharedSet(set, display, 'My set')
    expect(parseSharedSet(JSON.parse(JSON.stringify(shared)))).toEqual(shared)
  })

  it('keeps order and arc, clamps BPM and falls back for missing titles', () => {
    const shared = buildSharedSet(set, display, '   ')
    expect(shared.name).toBe('Untitled set')
    expect(shared.arc).toBe('warmup')
    expect(shared.tracks.map((t) => t.hash)).toEqual(tracks.map((t) => t.id))
    expect(shared.tracks[1]!.bpm).toBe(250)
    expect(shared.tracks[1]!.title).toBe('two.mp3')
    expect(shared.tracks[2]!.title).toBe('Untitled')
    expect(shared.transitions).toHaveLength(2)
  })

  it('formats a plain-text tracklist', () => {
    expect(tracklistText(valid())).toBe('1. X – One (8A, 124 BPM)\n2. Two (12B, 126 BPM)')
  })
})
