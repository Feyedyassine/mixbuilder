import { idbRequest } from '@/storage/idb-cache'
import type { FeatureOverride } from './feature-resolver'

// Manual BPM/key corrections, stored in this browser by content hash (IndexedDB
// 'overrides' store). Layered over the analyzed features by applyOverride — the
// cached analysis itself is never mutated. updatedAt is kept so corrections can be
// merged if a cloud library is added later.

interface StoredOverride {
  override: FeatureOverride
  updatedAt: string
}

export async function getOverride(hash: string): Promise<FeatureOverride | null> {
  const stored = await idbRequest<StoredOverride | undefined>('overrides', 'readonly', (s) =>
    s.get(hash),
  )
  return stored?.override ?? null
}

export async function setOverride(hash: string, override: FeatureOverride): Promise<void> {
  const stored: StoredOverride = { override, updatedAt: new Date().toISOString() }
  await idbRequest('overrides', 'readwrite', (s) => s.put(stored, hash))
}
