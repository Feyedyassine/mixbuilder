import type { KeyFeatures } from '@/analysis/feature-schema'

/** "Am" for A minor, "C" for C major. Empty when the key is unknown. */
export function formatMusicalKey(key: KeyFeatures): string {
  if (!key.key) return ''
  return key.scale === 'minor' ? `${key.key}m` : key.key
}

/** Seconds → m:ss. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]!)
}
