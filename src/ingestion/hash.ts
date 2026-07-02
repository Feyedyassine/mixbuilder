// Content hashing for the feature-cache key. We hash the file's size plus its
// first and last chunks rather than the whole file: for typical tracks (5–15 MB)
// that's nearly everything, but it stays bounded for very large files and is
// stable across re-selection of the same file. Not a security primitive — just a
// fast, collision-resistant content fingerprint.

const CHUNK_BYTES = 2 * 1024 * 1024 // 2 MB head + 2 MB tail

export interface ByteRange {
  start: number
  end: number
}

/**
 * Byte ranges to feed the hash. Small files hash whole; large files hash the head
 * and tail. Pure and deterministic so the selection logic is unit-testable.
 */
export function selectHashRanges(size: number, chunkBytes: number = CHUNK_BYTES): ByteRange[] {
  if (size <= chunkBytes * 2) return [{ start: 0, end: size }]
  return [
    { start: 0, end: chunkBytes },
    { start: size - chunkBytes, end: size },
  ]
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0')
  }
  return hex
}

type Sliceable = Pick<Blob, 'size' | 'slice'>

/**
 * SHA-256 over [size marker || head bytes || tail bytes]. Returns a lowercase hex
 * digest usable as a cache key and stable identity for a track.
 */
export async function computeContentHash(
  file: Sliceable,
  chunkBytes: number = CHUNK_BYTES,
): Promise<string> {
  const ranges = selectHashRanges(file.size, chunkBytes)

  // Prefix with the size so two files sharing head+tail but differing in length
  // (e.g. padded exports) never collide.
  const sizeMarker = new TextEncoder().encode(`${file.size}:`)
  const parts: BlobPart[] = [sizeMarker]
  for (const { start, end } of ranges) {
    parts.push(file.slice(start, end))
  }

  const combined = await new Blob(parts).arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', combined)
  return toHex(digest)
}
