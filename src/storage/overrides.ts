import { getSupabaseClient } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { FeatureOverride } from './feature-resolver'

// Per-user manual BPM/key corrections (user_tracks). Scoped to the signed-in user
// by RLS; layered over community features by applyOverride — never mutates the
// shared value.

export async function getOverride(hash: string): Promise<FeatureOverride | null> {
  const { data, error } = await getSupabaseClient()
    .from('user_tracks')
    .select('overrides')
    .eq('content_hash', hash)
    .maybeSingle()
  if (error || !data?.overrides) return null
  const o = data.overrides as Record<string, unknown>
  return {
    bpm: typeof o.bpm === 'number' ? o.bpm : undefined,
    camelot: typeof o.camelot === 'string' ? o.camelot : undefined,
    key: typeof o.key === 'string' ? o.key : undefined,
    scale: o.scale === 'major' || o.scale === 'minor' ? o.scale : undefined,
  }
}

export async function setOverride(
  userId: string,
  hash: string,
  override: FeatureOverride,
  meta: { title?: string; artist?: string } = {},
): Promise<void> {
  await getSupabaseClient()
    .from('user_tracks')
    .upsert(
      {
        user_id: userId,
        content_hash: hash,
        title: meta.title ?? null,
        artist: meta.artist ?? null,
        overrides: override as unknown as Json,
      },
      { onConflict: 'user_id,content_hash' },
    )
}
