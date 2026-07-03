import { describe, expect, it, vi } from 'vitest'
import { applyOverride, resolveFeatures, type CachePorts } from '@/storage/feature-resolver'
import { makeTrack } from '@/sequencing/fixtures'

const features = (bpm: number) => makeTrack({ bpm })

function ports(over: Partial<CachePorts> = {}): CachePorts {
  return {
    localGet: vi.fn(async () => null),
    localSet: vi.fn(async () => {}),
    ...over,
  }
}

describe('resolveFeatures — lookup order', () => {
  it('returns the local hit without touching community or analysis', async () => {
    const analyze = vi.fn(async () => features(200))
    const communityGet = vi.fn(async () => features(150))
    const p = ports({ localGet: vi.fn(async () => features(120)), communityGet })
    const res = await resolveFeatures({ hash: 'h', analyze }, p)
    expect(res.source).toBe('local')
    expect(res.features.tempo.bpm).toBe(120)
    expect(communityGet).not.toHaveBeenCalled()
    expect(analyze).not.toHaveBeenCalled()
  })

  it('falls back to community and writes through to local', async () => {
    const analyze = vi.fn(async () => features(200))
    const localSet = vi.fn(async () => {})
    const p = ports({ communityGet: vi.fn(async () => features(128)), localSet })
    const res = await resolveFeatures({ hash: 'h', analyze }, p)
    expect(res.source).toBe('community')
    expect(localSet).toHaveBeenCalledWith(
      'h',
      expect.objectContaining({ tempo: expect.anything() }),
    )
    expect(analyze).not.toHaveBeenCalled()
  })

  it('analyzes on a full miss and populates both caches', async () => {
    const analyze = vi.fn(async () => features(124))
    const localSet = vi.fn(async () => {})
    const communityPut = vi.fn(async () => {})
    const p = ports({ communityGet: vi.fn(async () => null), localSet, communityPut })
    const res = await resolveFeatures({ hash: 'h', analyze }, p)
    expect(res.source).toBe('fresh')
    expect(analyze).toHaveBeenCalledOnce()
    expect(localSet).toHaveBeenCalledOnce()
    expect(communityPut).toHaveBeenCalledOnce()
  })

  it('works signed-out (no community layer) and still caches locally', async () => {
    const localSet = vi.fn(async () => {})
    const p = ports({ localSet })
    const res = await resolveFeatures({ hash: 'h', analyze: async () => features(126) }, p)
    expect(res.source).toBe('fresh')
    expect(localSet).toHaveBeenCalledOnce()
  })

  it("doesn't fail analysis if the community write throws", async () => {
    const p = ports({
      communityGet: vi.fn(async () => null),
      communityPut: vi.fn(async () => {
        throw new Error('offline')
      }),
    })
    const res = await resolveFeatures({ hash: 'h', analyze: async () => features(124) }, p)
    expect(res.source).toBe('fresh')
  })
})

describe('applyOverride', () => {
  it('is a no-op without an override', () => {
    const f = features(124)
    expect(applyOverride(f, null)).toBe(f)
  })

  it('overrides BPM and key without mutating the input', () => {
    const f = features(124)
    const out = applyOverride(f, { bpm: 128, camelot: '9A' })
    expect(out.tempo.bpm).toBe(128)
    expect(out.key.camelot).toBe('9A')
    expect(f.tempo.bpm).toBe(124) // original untouched
  })
})
