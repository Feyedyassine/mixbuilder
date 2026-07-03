import { afterEach, describe, expect, it } from 'vitest'
import { localClear, localCount, localGet, localSet } from '@/storage/idb-cache'
import { makeTrack } from '@/sequencing/fixtures'

afterEach(() => localClear())

describe('idb-cache (browser)', () => {
  it('round-trips features by hash', async () => {
    await localSet('hash-a', makeTrack({ bpm: 128, camelot: '8A' }))
    const got = await localGet('hash-a')
    expect(got?.tempo.bpm).toBe(128)
    expect(got?.key.camelot).toBe('8A')
  })

  it('returns null for a missing hash', async () => {
    expect(await localGet('nope')).toBeNull()
  })

  it('persists across separate calls (own transactions)', async () => {
    await localSet('h1', makeTrack({ bpm: 120 }))
    await localSet('h2', makeTrack({ bpm: 124 }))
    expect(await localCount()).toBe(2)
    expect((await localGet('h2'))?.tempo.bpm).toBe(124)
  })

  it('clears the store', async () => {
    await localSet('h', makeTrack())
    await localClear()
    expect(await localCount()).toBe(0)
  })
})
