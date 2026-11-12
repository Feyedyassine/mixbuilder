import { FEATURE_SCHEMA_VERSION, type TrackFeatures } from '@/analysis/feature-schema'

// Everything mixbuilder keeps lives in this browser's IndexedDB — there is no
// server-side storage. Stores:
//   features  — analysis results by content hash (survives reloads, skips re-analysis)
//   sets      — saved sets (see sets-store.ts)
//   overrides — manual BPM/key corrections by content hash (see overrides.ts)
//
// Feature entries are stamped with the schema version and treated as misses when it
// doesn't match, so a schema bump transparently invalidates stale entries.
//
// Eviction: none yet. Feature JSON is tiny (~tens of KB) so thousands of tracks fit
// comfortably; an LRU cap is a documented follow-up if a library ever grows huge.

const DB_NAME = 'djmix'
const DB_VERSION = 2
const STORES = ['features', 'sets', 'overrides'] as const
export type StoreName = (typeof STORES)[number]

interface StoredFeatures {
  schemaVersion: number
  features: TrackFeatures
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Run one request against one store in its own transaction. */
export async function idbRequest<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(store, mode).objectStore(store))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return idbRequest('features', mode, run)
}

export async function localGet(hash: string): Promise<TrackFeatures | null> {
  const stored = await tx<StoredFeatures | undefined>('readonly', (s) => s.get(hash))
  if (!stored || stored.schemaVersion !== FEATURE_SCHEMA_VERSION) return null
  return stored.features
}

export async function localSet(hash: string, features: TrackFeatures): Promise<void> {
  await tx('readwrite', (s) => s.put({ schemaVersion: FEATURE_SCHEMA_VERSION, features }, hash))
}

export async function localCount(): Promise<number> {
  return tx<number>('readonly', (s) => s.count())
}

export async function localClear(): Promise<void> {
  await tx('readwrite', (s) => s.clear())
}
