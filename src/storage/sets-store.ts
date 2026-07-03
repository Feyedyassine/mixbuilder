import { getSupabaseClient } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { ArcName } from '@/sequencing/arc'
import type { SequencedSet } from '@/sequencing/sequencer'
import type { TrackDisplay } from '@/export/build'

// Saved sets (sets table). A set stores only what's needed to re-open and display
// it without the audio files: the ordered track hashes + display metadata + arc.
// Features are re-fetched by hash from the cache on load, so a set opened on
// another machine still shows order/BPM/key even when the local files are absent.

export interface SavedTrackRef {
  hash: string
  fileName: string
  title: string
  artist?: string
}

export interface SavedSetData {
  version: 1
  arc: ArcName
  tracks: SavedTrackRef[]
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
        title: d?.title ?? t.id,
        ...(d?.artist ? { artist: d.artist } : {}),
      }
    }),
  }
}

export async function listSets(): Promise<SetSummary[]> {
  const { data, error } = await getSupabaseClient()
    .from('sets')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }))
}

export async function saveSet(
  userId: string,
  name: string,
  data: SavedSetData,
  id?: string,
): Promise<string | null> {
  const client = getSupabaseClient()
  if (id) {
    const { error } = await client
      .from('sets')
      .update({ name, data: data as unknown as Json })
      .eq('id', id)
    return error ? null : id
  }
  const { data: inserted, error } = await client
    .from('sets')
    .insert({ user_id: userId, name, data: data as unknown as Json })
    .select('id')
    .single()
  return error || !inserted ? null : inserted.id
}

export async function loadSet(id: string): Promise<{ name: string; data: SavedSetData } | null> {
  const { data, error } = await getSupabaseClient()
    .from('sets')
    .select('name, data')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return { name: data.name, data: data.data as unknown as SavedSetData }
}

export async function renameSet(id: string, name: string): Promise<void> {
  await getSupabaseClient().from('sets').update({ name }).eq('id', id)
}

export async function deleteSet(id: string): Promise<void> {
  await getSupabaseClient().from('sets').delete().eq('id', id)
}

export async function duplicateSet(userId: string, id: string): Promise<string | null> {
  const existing = await loadSet(id)
  if (!existing) return null
  return saveSet(userId, `${existing.name} (copy)`, existing.data)
}
