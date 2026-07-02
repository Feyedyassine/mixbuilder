import { describe, expect, it } from 'vitest'
import { computeContentHash } from '@/ingestion/hash'

// crypto.subtle + Blob in a real browser (production environment for hashing).

function blobOf(bytes: number[]): Blob {
  return new Blob([new Uint8Array(bytes)])
}

describe('computeContentHash (browser)', () => {
  it('is a 64-char hex SHA-256 digest', async () => {
    const hash = await computeContentHash(blobOf([1, 2, 3, 4]))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is stable for identical content (re-selection safety)', async () => {
    const a = await computeContentHash(blobOf([9, 8, 7, 6, 5]))
    const b = await computeContentHash(blobOf([9, 8, 7, 6, 5]))
    expect(a).toBe(b)
  })

  it('differs when content differs', async () => {
    const a = await computeContentHash(blobOf([1, 1, 1, 1]))
    const b = await computeContentHash(blobOf([1, 1, 1, 2]))
    expect(a).not.toBe(b)
  })

  it('differs when only the size differs (size is mixed in)', async () => {
    const a = await computeContentHash(blobOf([1, 2, 3]))
    const b = await computeContentHash(blobOf([1, 2, 3, 0]))
    expect(a).not.toBe(b)
  })

  it('hashes large files via head+tail without reading everything', async () => {
    // 6 MB of zeros with a marker byte near the end; small chunk size forces the
    // head/tail path. Head is identical to an all-zero file; the tail marker must
    // still change the hash.
    const chunk = 1024
    const size = 6 * 1024 * 1024
    const base = new Uint8Array(size)
    const marked = new Uint8Array(size)
    marked[size - 10] = 42

    const h1 = await computeContentHash(new Blob([base]), chunk)
    const h2 = await computeContentHash(new Blob([marked]), chunk)
    expect(h1).not.toBe(h2)
  })
})
