import { describe, expect, it } from 'vitest'
import { runWithConcurrency } from '@/lib/concurrency'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('runWithConcurrency', () => {
  it('runs every item exactly once', async () => {
    const seen: number[] = []
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      await tick()
      seen.push(n)
    })
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })

  it('never exceeds the concurrency limit', async () => {
    let active = 0
    let peak = 0
    await runWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      4,
      async () => {
        active++
        peak = Math.max(peak, active)
        await tick()
        active--
      },
    )
    expect(peak).toBeLessThanOrEqual(4)
  })

  it('handles an empty list', async () => {
    let calls = 0
    await runWithConcurrency([], 4, async () => {
      calls++
    })
    expect(calls).toBe(0)
  })

  it('processes all items even when the limit exceeds the count', async () => {
    const seen: number[] = []
    await runWithConcurrency([1, 2], 10, async (n) => {
      seen.push(n)
    })
    expect(seen).toHaveLength(2)
  })
})
