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

/** SVG polyline path ("M x,y L x,y …") for a value series. */
export function linePath(
  values: number[],
  width: number,
  height: number,
  min = 0,
  max = 1,
): string {
  const pts = scalePoints(values, width, height, min, max)
  if (pts.length === 0) return ''
  return 'M' + pts.map(([x, y]) => `${r(x)},${r(y)}`).join(' L')
}

/** Closed area path under a value series (for a filled sparkline). */
export function areaPath(
  values: number[],
  width: number,
  height: number,
  min = 0,
  max = 1,
): string {
  const pts = scalePoints(values, width, height, min, max)
  if (pts.length === 0) return ''
  const line = pts.map(([x, y]) => `${r(x)},${r(y)}`).join(' L')
  const firstX = r(pts[0]![0])
  const lastX = r(pts[pts.length - 1]![0])
  return `M${firstX},${height} L${line} L${lastX},${height} Z`
}
