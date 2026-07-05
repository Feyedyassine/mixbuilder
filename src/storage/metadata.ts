import { getSupabaseClient } from '@/lib/supabase'

// Best-effort metadata capture on analyze. Two destinations:
//   track_metadata — anonymous, shared by hash (first writer wins) → catalog analytics
//   user_tracks    — per-user (seeds the future library); preserves any override
// Both are fire-and-forget; failures must never affect analysis.

export interface TrackMeta {
  title?: string
  artist?: string
  genre?: string
}

/** Contribute anonymous track metadata to the shared catalog (first writer wins). */
export async function putTrackMetadata(hash: string, meta: TrackMeta): Promise<void> {
  await getSupabaseClient()
    .from('track_metadata')
    .upsert(
      {
        content_hash: hash,
        title: meta.title ?? null,
        artist: meta.artist ?? null,
        genre: meta.genre ?? null,
      },
      { onConflict: 'content_hash', ignoreDuplicates: true },
    )
}

/**
 * Record that this user has analyzed this track (seeds their library). Only
 * title/artist are written, so an existing manual override is left untouched.
 */
export async function putUserTrack(userId: string, hash: string, meta: TrackMeta): Promise<void> {
  await getSupabaseClient()
    .from('user_tracks')
    .upsert(
      {
        user_id: userId,
        content_hash: hash,
        title: meta.title ?? null,
        artist: meta.artist ?? null,
      },
      { onConflict: 'user_id,content_hash' },
    )
}
