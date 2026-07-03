import { getSupabaseClient } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { FEATURE_SCHEMA_VERSION, type TrackFeatures } from '@/analysis/feature-schema'

// Community feature cache in Supabase (track_features). Readable + contributable by
// any authenticated user (RLS); entries are keyed by content hash + schema version,
// so features are shared across everyone and immutable per (hash, version).

export async function communityGet(hash: string): Promise<TrackFeatures | null> {
  const { data, error } = await getSupabaseClient()
    .from('track_features')
    .select('features')
    .eq('content_hash', hash)
    .eq('schema_version', FEATURE_SCHEMA_VERSION)
    .maybeSingle()
  if (error || !data) return null
  return data.features as unknown as TrackFeatures
}

export async function communityPut(hash: string, features: TrackFeatures): Promise<void> {
  // First writer wins — ignore conflicts so we never clobber an existing entry.
  await getSupabaseClient()
    .from('track_features')
    .upsert(
      {
        content_hash: hash,
        schema_version: FEATURE_SCHEMA_VERSION,
        features: features as unknown as Json,
      },
      { onConflict: 'content_hash', ignoreDuplicates: true },
    )
}
