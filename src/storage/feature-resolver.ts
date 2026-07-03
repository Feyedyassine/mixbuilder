import type { KeyFeatures, TrackFeatures } from '@/analysis/feature-schema'

// Resolves a track's features through the cache layers before paying for analysis:
//   local (IndexedDB) → community (Supabase) → fresh analysis
// with write-through so a hit populates the faster layers. Ports are injected so
// the lookup order is pure and unit-testable; the real ports live in the storage
// and analysis modules.

export type FeatureSource = 'local' | 'community' | 'fresh'

export interface FeatureLookup {
  hash: string
  /** The expensive path: decode + analyze. Called only on a full miss. */
  analyze: () => Promise<TrackFeatures>
}

export interface CachePorts {
  localGet: (hash: string) => Promise<TrackFeatures | null>
  localSet: (hash: string, features: TrackFeatures) => Promise<void>
  /** Community layer is present only when signed in. */
  communityGet?: (hash: string) => Promise<TrackFeatures | null>
  communityPut?: (hash: string, features: TrackFeatures) => Promise<void>
}

export interface ResolvedFeatures {
  features: TrackFeatures
  source: FeatureSource
}

export async function resolveFeatures(
  lookup: FeatureLookup,
  ports: CachePorts,
): Promise<ResolvedFeatures> {
  const local = await ports.localGet(lookup.hash)
  if (local) return { features: local, source: 'local' }

  if (ports.communityGet) {
    const community = await ports.communityGet(lookup.hash)
    if (community) {
      await ports.localSet(lookup.hash, community)
      return { features: community, source: 'community' }
    }
  }

  const fresh = await lookup.analyze()
  await ports.localSet(lookup.hash, fresh)
  // Contributing to the community cache is best-effort — never fail analysis on it.
  if (ports.communityPut) await ports.communityPut(lookup.hash, fresh).catch(() => {})
  return { features: fresh, source: 'fresh' }
}

// ── manual overrides (user_tracks) ───────────────────────────────────────────
// Overrides are the DJ's corrections. They sit ABOVE the cache: applied on top of
// whatever features were resolved, so user override > community > fresh, and they
// never mutate the shared community value.

export interface FeatureOverride {
  bpm?: number
  camelot?: string
  key?: string
  scale?: 'major' | 'minor'
}

export function applyOverride(
  features: TrackFeatures,
  override: FeatureOverride | null | undefined,
): TrackFeatures {
  if (!override || (override.bpm === undefined && !override.camelot && !override.key)) {
    return features
  }
  const tempo =
    override.bpm !== undefined ? { ...features.tempo, bpm: override.bpm } : features.tempo
  const key: KeyFeatures = {
    ...features.key,
    ...(override.key ? { key: override.key } : {}),
    ...(override.scale ? { scale: override.scale } : {}),
    ...(override.camelot ? { camelot: override.camelot } : {}),
  }
  return { ...features, tempo, key }
}
