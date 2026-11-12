import type { SectionLabel } from '@/analysis/feature-schema'

export const SECTION_COLORS: Record<SectionLabel, string> = {
  intro: '#3b82f6', // blue
  build: '#f59e0b', // amber
  drop: '#ef4444', // red
  breakdown: '#a855f7', // purple
  outro: '#64748b', // slate
}

/** Hue (0–360) for a Camelot code by wheel position, or null for an invalid code. */
export function camelotHue(code: string): number | null {
  const m = /^(\d{1,2})[AB]$/.exec(code)
  return m ? Math.round(((Number(m[1]) - 1) / 12) * 360) : null
}

/** Color a Camelot code by its wheel position (adjacent keys → adjacent hues). */
export function camelotColor(code: string): string {
  const hue = camelotHue(code)
  return hue === null ? '#6b7280' : `hsl(${hue}, 55%, 50%)`
}

/** Dark, muted variant for backgrounds (e.g. the art-less cover fallback tile). */
export function camelotColorMuted(code: string): string {
  const hue = camelotHue(code)
  return hue === null ? '#262626' : `hsl(${hue}, 40%, 20%)`
}
