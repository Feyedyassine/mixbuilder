import { analyzeAudioFile } from './analysis-service'
import { localGet, localSet } from '@/storage/idb-cache'
import { getOverride } from '@/storage/overrides'
import { applyOverride, resolveFeatures, type ResolvedFeatures } from '@/storage/feature-resolver'

// Bridges analysis and storage: resolve a track's features through the local
// cache, only decoding + running the worker on a miss. Any saved manual BPM/key
// correction is re-applied on top.

export async function analyzeWithCache(file: File, hash: string): Promise<ResolvedFeatures> {
  const resolved = await resolveFeatures(
    { hash, analyze: () => analyzeAudioFile(file) },
    { localGet, localSet },
  )
  const override = await getOverride(hash).catch(() => null)
  return override ? { ...resolved, features: applyOverride(resolved.features, override) } : resolved
}
