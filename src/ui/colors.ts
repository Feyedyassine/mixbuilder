import type { SectionLabel } from '@/analysis/feature-schema'

export const SECTION_COLORS: Record<SectionLabel, string> = {
  intro: '#3b82f6', // blue
  build: '#f59e0b', // amber
  drop: '#ef4444', // red
  breakdown: '#a855f7', // purple
  outro: '#64748b', // slate
}

/** Color a Camelot code by its wheel position (adjacent keys → adjacent hues). */
export function camelotColor(code: string): string {
  const m = /^(\d{1,2})[AB]$/.exec(code)
  if (!m) return '#6b7280'
  const hue = ((Number(m[1]) - 1) / 12) * 360
  return `hsl(${Math.round(hue)}, 55%, 50%)`
}

/** Dark, muted variant for backgrounds (e.g. the art-less cover fallback tile). */
export function camelotColorMuted(code: string): string {
  const m = /^(\d{1,2})[AB]$/.exec(code)
  if (!m) return '#262626'
  const hue = ((Number(m[1]) - 1) / 12) * 360
  return `hsl(${Math.round(hue)}, 40%, 20%)`
}
