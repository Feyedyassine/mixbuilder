import { describe, expect, it, vi } from 'vitest'
import { ingestFiles } from '@/ingestion/ingest'
import type { PickedFile } from '@/ingestion/pick'

function pickedFile(name: string, bytes: number[], type = 'audio/wav'): PickedFile {
  return { file: new File([new Uint8Array(bytes)], name, { type }) }
}

describe('ingestFiles (browser)', () => {
  it('normalizes a picked file into a TrackFile with hash and tags', async () => {
    const [track] = await ingestFiles([pickedFile('Bicep - Glue.wav', [1, 2, 3, 4])])
    expect(track).toBeDefined()
    expect(track!.contentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(track!.id).toBe(track!.contentHash)
    expect(track!.name).toBe('Bicep - Glue.wav')
    // Random bytes aren't a valid WAV, so tags fall back to the filename.
    expect(track!.tags).toEqual({ artist: 'Bicep', title: 'Glue' })
  })

  it('deduplicates identical content', async () => {
    const tracks = await ingestFiles([
      pickedFile('a.wav', [5, 5, 5]),
      pickedFile('copy.wav', [5, 5, 5]),
    ])
    expect(tracks).toHaveLength(1)
  })

  it('keeps distinct content separate', async () => {
    const tracks = await ingestFiles([pickedFile('a.wav', [1]), pickedFile('b.wav', [2])])
    expect(tracks).toHaveLength(2)
  })

  it('reports progress to completion', async () => {
    const onProgress = vi.fn()
    await ingestFiles([pickedFile('a.wav', [1]), pickedFile('b.wav', [2])], { onProgress })
    const last = onProgress.mock.calls.at(-1)?.[0]
    expect(last).toMatchObject({ done: 2, total: 2 })
  })
})
