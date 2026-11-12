import { idbRequest } from '@/storage/idb-cache'
import type { ArcName } from '@/sequencing/arc'
import type { SequencedSet } from '@/sequencing/sequencer'
import type { TrackDisplay } from '@/export/build'

// Saved sets, stored in this browser (IndexedDB 'sets' store). A set stores only
// what's needed to re-open and display it without the audio files: the ordered
// track hashes + display metadata + arc. Features are re-read by hash from the
// local feature cache on open.
//
// Sync-ready by design, so a cloud library can be layered behind this API later
// without migrating data: ids are client-generated UUIDs (no collisions on
// upload), records carry createdAt/updatedAt for merging, and each track ref
// carries enough metadata (title, file name, BPM, key) to list a set on its own.

export interface SavedTrackRef {
  hash: string
  fileName: string
  /** Path within the user's music folder, for exports (see TrackFile.relativePath). */
  relativePath?: string
  title: string
  artist?: string
  bpm?: number
  camelot?: string
}

export interface SavedSetData {
  version: 1
  arc: ArcName
  tracks: SavedTrackRef[]
}

export interface SavedSetRecord {
  id: string
  name: string
  /** ISO timestamps. */
  createdAt: string
  updatedAt: string
  data: SavedSetData
}

export interface SetSummary {
  id: string
  name: string
  updatedAt: string
}

export function serializeSet(
  set: SequencedSet,
  displayById: Map<string, TrackDisplay>,
): SavedSetData {
  return {
    version: 1,
    arc: set.arc,
    tracks: set.order.map((t) => {
      const d = displayById.get(t.id)
      return {
        hash: t.id,
        fileName: d?.fileName ?? '',
        ...(d?.relativePath && d.relativePath !== d.fileName
          ? { relativePath: d.relativePath }
          : {}),
        title: d?.title ?? t.id,
        ...(d?.artist ? { artist: d.artist } : {}),
        bpm: t.features.tempo.bpm,
        camelot: t.features.key.camelot,
      }
    }),
  }
}

export async function listSets(): Promise<SetSummary[]> {
  const records = await idbRequest<SavedSetRecord[]>('sets', 'readonly', (s) => s.getAll())
  return records
    .map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadSet(id: string): Promise<SavedSetRecord | null> {
  const record = await idbRequest<SavedSetRecord | undefined>('sets', 'readonly', (s) => s.get(id))
  return record ?? null
}

/** Create a set (no id) or overwrite an existing one. Returns the set's id. */
export async function saveSet(name: string, data: SavedSetData, id?: string): Promise<string> {
  const now = new Date().toISOString()
  const existing = id ? await loadSet(id) : null
  const record: SavedSetRecord = {
    id: existing?.id ?? crypto.randomUUID(),
    name,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    data,
  }
  await idbRequest('sets', 'readwrite', (s) => s.put(record, record.id))
  return record.id
}

export async function renameSet(id: string, name: string): Promise<void> {
  const existing = await loadSet(id)
  if (!existing) return
  await saveSet(name, existing.data, id)
}

export async function deleteSet(id: string): Promise<void> {
  await idbRequest('sets', 'readwrite', (s) => s.delete(id))
}

/**
 * Ask the browser not to evict mixbuilder's storage under disk pressure. Best
 * effort: browsers may grant it silently, prompt, or refuse — saving works either way.
 */
export async function requestPersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return
  if (await navigator.storage.persisted()) return
  await navigator.storage.persist().catch(() => false)
}
