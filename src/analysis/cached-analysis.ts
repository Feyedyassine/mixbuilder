import { analyzeAudioFile } from './analysis-service'
import { localGet, localSet } from '@/storage/idb-cache'
import { communityGet, communityPut } from '@/storage/community-cache'
import { getOverride } from '@/storage/overrides'
import {
  applyOverride,
  resolveFeatures,
  type CachePorts,
  type ResolvedFeatures,
} from '@/storage/feature-resolver'

// Bridges analysis and storage: resolve a track's features through the caches
// (local → community → analyze), only decoding + running the worker on a full
// miss. The community layer is included only when signed in. When signed in, any
// saved per-user override (manual BPM/key correction) is re-applied on top.

export async function analyzeWithCache(
  file: File,
  hash: string,
  opts: { signedIn: boolean } = { signedIn: false },
): Promise<ResolvedFeatures> {
  const ports: CachePorts = {
    localGet,
    localSet,
    ...(opts.signedIn ? { communityGet, communityPut } : {}),
  }
  const resolved = await resolveFeatures({ hash, analyze: () => analyzeAudioFile(file) }, ports)
  if (!opts.signedIn) return resolved

  const override = await getOverride(hash).catch(() => null)
  return override ? { ...resolved, features: applyOverride(resolved.features, override) } : resolved
}
