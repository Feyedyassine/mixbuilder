import { afterEach, describe, expect, it } from 'vitest'
import { idbRequest, localGet } from '@/storage/idb-cache'
import { FEATURE_SCHEMA_VERSION } from '@/analysis/feature-schema'
import { deleteSet, listSets, loadSet, renameSet, saveSet } from '@/storage/sets-store'
import type { SavedSetData } from '@/storage/sets-store'
import { getOverride, setOverride } from '@/storage/overrides'
import { makeTrack } from '@/sequencing/fixtures'

afterEach(async () => {
  await idbRequest('sets', 'readwrite', (s) => s.clear())
  await idbRequest('overrides', 'readwrite', (s) => s.clear())
})

const data = (title = 'One'): SavedSetData => ({
  version: 1,
  arc: 'journey',
  tracks: [{ hash: 'h1', fileName: 'one.mp3', title, bpm: 124, camelot: '8A' }],
})

describe('sets-store (browser)', () => {
  it('saves a new set with a UUID and timestamps, and loads it back', async () => {
    const id = await saveSet('Friday', data())
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    const record = await loadSet(id)
    expect(record?.name).toBe('Friday')
    expect(record?.data.tracks[0]?.camelot).toBe('8A')
    expect(record?.createdAt).toBe(record?.updatedAt)
  })

  it('updates in place, keeping id and createdAt', async () => {
    const id = await saveSet('Friday', data())
    const before = await loadSet(id)
    await new Promise((r) => setTimeout(r, 5))
    expect(await saveSet('Friday v2', data('Two'), id)).toBe(id)
    const after = await loadSet(id)
    expect(after?.name).toBe('Friday v2')
    expect(after?.data.tracks[0]?.title).toBe('Two')
    expect(after?.createdAt).toBe(before?.createdAt)
    expect(after!.updatedAt > before!.updatedAt).toBe(true)
  })

  it('lists most recently updated first, renames and deletes', async () => {
    const a = await saveSet('A', data())
    await new Promise((r) => setTimeout(r, 5))
    const b = await saveSet('B', data())
    expect((await listSets()).map((s) => s.id)).toEqual([b, a])

    await new Promise((r) => setTimeout(r, 5))
    await renameSet(a, 'A renamed')
    expect((await listSets()).map((s) => s.name)).toEqual(['A renamed', 'B'])

    await deleteSet(b)
    expect(await loadSet(b)).toBeNull()
    expect(await listSets()).toHaveLength(1)
  })
})

describe('overrides (browser)', () => {
  it('round-trips a correction by hash', async () => {
    expect(await getOverride('h1')).toBeNull()
    await setOverride('h1', { bpm: 126, camelot: '9A' })
    expect(await getOverride('h1')).toEqual({ bpm: 126, camelot: '9A' })
  })
})

describe('idb upgrade (browser)', () => {
  it('upgrades a v1 database (features only) without losing cached analysis', async () => {
    await new Promise<void>((resolve, reject) => {
      const del = indexedDB.deleteDatabase('djmix')
      del.onsuccess = () => resolve()
      del.onerror = () => reject(del.error)
    })
    // Recreate the pre-upgrade shape: version 1 with only the features store, holding
    // one entry written in the old format.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('djmix', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('features')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('features', 'readwrite')
        tx.objectStore('features').put(
          { schemaVersion: FEATURE_SCHEMA_VERSION, features: makeTrack({ bpm: 122 }) },
          'old',
        )
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })

    const id = await saveSet('After upgrade', data())
    expect((await loadSet(id))?.name).toBe('After upgrade')
    expect((await localGet('old'))?.tempo.bpm).toBe(122)
  })
})
