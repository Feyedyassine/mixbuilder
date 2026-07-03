// Pure SVG-path helpers for the timeline visuals. Kept separate from components so
// the geometry is unit-testable.

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

const r = (n: number) => Math.round(n * 100) / 100

/** Scale a value series to [x, y] points inside a width×height box (y is flipped). */
export function scalePoints(
  values: number[],
  width: number,
  height: number,
  min = 0,
  max = 1,
): [number, number][] {
  const n = values.length
  if (n === 0) return []
  const span = max - min || 1
  return values.map((v, i) => {
    const x = n === 1 ? width / 2 : (i / (n - 1)) * width
    const y = height - ((clamp(v, min, max) - min) / span) * height
    return [x, y]
  })
}

/** Polyline path from pre-scaled points. */
export function pointsToLine(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  return 'M' + pts.map(([x, y]) => `${r(x)},${r(y)}`).join(' L')
}

/** Closed area path (down to the baseline) from pre-scaled points. */
export function pointsToArea(pts: [number, number][], height: number): string {
  if (pts.length === 0) return ''
  const line = pts.map(([x, y]) => `${r(x)},${r(y)}`).join(' L')
  return `M${r(pts[0]![0])},${height} L${line} L${r(pts[pts.length - 1]![0])},${height} Z`
}

/** SVG polyline path ("M x,y L x,y …") for a value series. */
export function linePath(
  values: number[],
  width: number,
  height: number,
  min = 0,
  max = 1,
): string {
  return pointsToLine(scalePoints(values, width, height, min, max))
}

/** Closed area path under a value series (for a filled sparkline). */
export function areaPath(
  values: number[],
  width: number,
  height: number,
  min = 0,
  max = 1,
): string {
  return pointsToArea(scalePoints(values, width, height, min, max), height)
}
