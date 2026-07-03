import { analyzeAudioFile } from './analysis-service'
import { localGet, localSet } from '@/storage/idb-cache'
import { communityGet, communityPut } from '@/storage/community-cache'
import { resolveFeatures, type CachePorts, type ResolvedFeatures } from '@/storage/feature-resolver'

// Bridges analysis and storage: resolve a track's features through the caches
// (local → community → analyze), only decoding + running the worker on a full
// miss. The community layer is included only when signed in.

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
  return resolveFeatures({ hash, analyze: () => analyzeAudioFile(file) }, ports)
}
