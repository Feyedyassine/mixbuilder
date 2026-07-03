import { FEATURE_SCHEMA_VERSION, type TrackFeatures } from '@/analysis/feature-schema'

// Local feature cache in IndexedDB: survives reloads and works signed-out. Entries
// are stamped with the schema version and treated as misses when it doesn't match,
// so a schema bump transparently invalidates stale entries.
//
// Eviction: none yet. Feature JSON is tiny (~tens of KB) so thousands of tracks fit
// comfortably; an LRU cap is a documented follow-up if a library ever grows huge.

const DB_NAME = 'djmix'
const DB_VERSION = 1
const STORE = 'features'

interface StoredFeatures {
  schemaVersion: number
  features: TrackFeatures
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
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
