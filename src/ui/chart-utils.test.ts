import { describe, expect, it } from 'vitest'
import { areaPath, linePath, pointsToArea, pointsToLine, scalePoints } from '@/ui/chart-utils'

describe('scalePoints', () => {
  it('spreads points across the width and flips y', () => {
    const pts = scalePoints([0, 1], 100, 50)
    expect(pts[0]).toEqual([0, 50]) // value 0 → bottom
    expect(pts[1]).toEqual([100, 0]) // value 1 → top
  })

  it('centers a single point', () => {
    expect(scalePoints([0.5], 100, 50)).toEqual([[50, 25]])
  })

  it('clamps out-of-range values', () => {
    const pts = scalePoints([-1, 2], 10, 40)
    expect(pts[0]![1]).toBe(40)
    expect(pts[1]![1]).toBe(0)
  })

  it('returns nothing for an empty series', () => {
    expect(scalePoints([], 100, 50)).toEqual([])
  })
})

describe('linePath', () => {
  it('builds an M/L path', () => {
    expect(linePath([0, 1], 100, 50)).toBe('M0,50 L100,0')
  })
  it('is empty for no values', () => {
    expect(linePath([], 100, 50)).toBe('')
  })
})

describe('areaPath', () => {
  it('closes the path along the baseline', () => {
    const p = areaPath([0.5, 0.5], 100, 50)
    expect(p.startsWith('M0,50')).toBe(true)
    expect(p.endsWith('Z')).toBe(true)
  })
})

describe('points builders', () => {
  it('build line/area from pre-scaled points (for per-section sub-paths)', () => {
    const pts: [number, number][] = [
      [20, 10],
      [40, 5],
    ]
    expect(pointsToLine(pts)).toBe('M20,10 L40,5')
    const area = pointsToArea(pts, 50)
    expect(area.startsWith('M20,50')).toBe(true)
    expect(area.endsWith('L40,50 Z')).toBe(true)
  })

  it('are empty for no points', () => {
    expect(pointsToLine([])).toBe('')
    expect(pointsToArea([], 50)).toBe('')
  })
})
