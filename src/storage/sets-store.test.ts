import { describe, expect, it } from 'vitest'
import { serializeSet } from '@/storage/sets-store'
import { sequenceInOrder, type AnalyzedTrack } from '@/sequencing/sequencer'
import { makeTrack } from '@/sequencing/fixtures'
import type { TrackDisplay } from '@/export/build'

describe('serializeSet', () => {
  it('captures ordered hashes, display info and arc', () => {
    const tracks: AnalyzedTrack[] = [
      { id: 'h1', features: makeTrack({ bpm: 124, camelot: '8A' }) },
      { id: 'h2', features: makeTrack({ bpm: 125, camelot: '9A' }) },
    ]
    const set = sequenceInOrder(tracks, { arc: 'warmup' })
    const display = new Map<string, TrackDisplay>([
      ['h1', { fileName: 'one.mp3', title: 'One', artist: 'X' }],
      ['h2', { fileName: 'two.mp3', title: 'Two' }],
    ])
    const data = serializeSet(set, display)

    expect(data.version).toBe(1)
    expect(data.arc).toBe('warmup')
    expect(data.tracks.map((t) => t.hash)).toEqual(['h1', 'h2'])
    expect(data.tracks[0]).toEqual({ hash: 'h1', fileName: 'one.mp3', title: 'One', artist: 'X' })
    // No display info → falls back without an artist key.
    expect(data.tracks[1]!.artist).toBeUndefined()
  })
})

describe('sequenceInOrder', () => {
  it('preserves the given order and builds n-1 transitions', () => {
    const tracks: AnalyzedTrack[] = ['8A', '2B', '9A'].map((c, i) => ({
      id: `h${i}`,
      features: makeTrack({ camelot: c }),
    }))
    const set = sequenceInOrder(tracks)
    expect(set.order.map((t) => t.id)).toEqual(['h0', 'h1', 'h2'])
    expect(set.transitions).toHaveLength(2)
  })

  it('handles an empty set', () => {
    const set = sequenceInOrder([])
    expect(set.order).toHaveLength(0)
    expect(set.transitions).toHaveLength(0)
  })
})
