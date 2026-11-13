import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coresBucket, detectWebGpu, memoryBucket } from '@/lib/capabilities'

describe('detectWebGpu', () => {
  it('reports no_api when the browser has no WebGPU', async () => {
    expect(await detectWebGpu(undefined)).toBe('no_api')
  })

  it('reports no_adapter when no GPU is available (e.g. blocklisted driver)', async () => {
    expect(await detectWebGpu({ requestAdapter: async () => null })).toBe('no_adapter')
  })

  it('tells real hardware from a software fallback adapter', async () => {
    expect(await detectWebGpu({ requestAdapter: async () => ({ info: {} }) })).toBe('yes')
    expect(
      await detectWebGpu({ requestAdapter: async () => ({ info: { isFallbackAdapter: true } }) }),
    ).toBe('fallback')
    expect(await detectWebGpu({ requestAdapter: async () => ({ isFallbackAdapter: true }) })).toBe(
      'fallback',
    )
  })

  it('reports error if probing throws', async () => {
    const gpu = {
      requestAdapter: async () => {
        throw new Error('boom')
      },
    }
    expect(await detectWebGpu(gpu)).toBe('error')
  })
})

describe('buckets', () => {
  it.each([
    [undefined, 'unknown'],
    [2, '1-4'],
    [4, '1-4'],
    [8, '5-8'],
    [16, '9+'],
  ])('cores %s → %s', (n, expected) => expect(coresBucket(n)).toBe(expected))

  it.each([
    [undefined, 'unknown'],
    [2, '<4'],
    [4, '4-7'],
    [8, '8+'],
  ])('memory %s GB → %s', (gb, expected) => expect(memoryBucket(gb)).toBe(expected))
})

describe('reportCapabilitiesOnce', () => {
  type W = Window & { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] }
  const w = window as W
  let events: unknown[][]

  beforeEach(() => {
    vi.resetModules()
    sessionStorage.clear()
    events = []
  })
  afterEach(() => {
    delete w.gtag
  })

  it('does nothing while analytics is off (e.g. before EU consent)', async () => {
    const { reportCapabilitiesOnce } = await import('@/lib/capabilities')
    await reportCapabilitiesOnce()
    expect(sessionStorage.getItem('mb-capabilities-sent')).toBeNull()
  })

  it('sends one coarse event per session once analytics runs', async () => {
    w.gtag = (...args: unknown[]) => events.push(args)
    const { reportCapabilitiesOnce } = await import('@/lib/capabilities')
    await reportCapabilitiesOnce()
    await reportCapabilitiesOnce()
    expect(events).toHaveLength(1)
    const [kind, name, params] = events[0]!
    expect([kind, name]).toEqual(['event', 'device_capabilities'])
    expect(Object.keys(params as object).sort()).toEqual(['cpu_cores', 'device_memory', 'webgpu'])
  })
})
