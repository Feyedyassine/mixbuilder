import type { PickedFile } from './pick'
import type { TrackFile } from './types'
import { computeContentHash } from './hash'
import { readTags } from './tags'

export interface IngestProgress {
  done: number
  total: number
  current: string
}

export interface IngestOptions {
  onProgress?: (progress: IngestProgress) => void
}

/**
 * Turn picked files into normalized TrackFiles: content-hash (cache key/identity)
 * plus best-effort tags. Files that fail to hash are skipped rather than aborting
 * the whole batch. Deduplicates by content hash so the same track picked twice
 * (or found in two folders) appears once.
 */
export async function ingestFiles(
  picked: PickedFile[],
  { onProgress }: IngestOptions = {},
): Promise<TrackFile[]> {
  const byHash = new Map<string, TrackFile>()
  let done = 0

  for (const { file, handle } of picked) {
    onProgress?.({ done, total: picked.length, current: file.name })
    try {
      const [contentHash, tags] = await Promise.all([computeContentHash(file), readTags(file)])
      if (!byHash.has(contentHash)) {
        byHash.set(contentHash, {
          id: contentHash,
          file,
          name: file.name,
          size: file.size,
          contentHash,
          tags,
          handle,
        })
      }
    } catch {
      // Skip unreadable files; a corrupt or permission-revoked file shouldn't
      // sink the batch.
    } finally {
      done += 1
    }
  }

  onProgress?.({ done, total: picked.length, current: '' })
  return [...byHash.values()]
}
