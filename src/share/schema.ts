import { ARC_LABELS, type ArcName } from '../sequencing/arc'

// Shared-set payload: what a "Share" link stores on the server. Used by both the
// app and the Cloudflare Worker (worker/), so it must stay free of browser-only
// imports and the '@/' alias. Only display data is shared — never audio or file
// paths. `hash` is the track's content fingerprint, so a viewer who owns the same
// file gets an exact match when they add it.

export const SHARE_VERSION = 1
export const MAX_SHARE_BYTES = 64 * 1024
export const MAX_SHARED_TRACKS = 200
export const SHARE_ID_PATTERN = /^[A-Za-z0-9]{10}$/

export interface SharedTrack {
  hash: string
  title: string
  artist?: string
  bpm: number
  camelot: string
  /** Absolute energy, 1–10. */
  energy: number
}

export interface SharedSet {
  version: typeof SHARE_VERSION
  name: string
  arc: ArcName
  /** Mean transition score, 0–1. */
  flow: number
  /** Score of each transition, 0–1 (tracks.length − 1 entries). */
  transitions: number[]
  tracks: SharedTrack[]
}

const HASH = /^[0-9a-f]{64}$/
const CAMELOT = /^(1[0-2]|[1-9])[AB]$/

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function parseTrack(input: unknown): SharedTrack | null {
  if (typeof input !== 'object' || input === null) return null
  const t = input as Record<string, unknown>
  const title = text(t.title, 200)
  if (!title || typeof t.hash !== 'string' || !HASH.test(t.hash)) return null
  if (typeof t.camelot !== 'string' || !CAMELOT.test(t.camelot)) return null
  if (!inRange(t.bpm, 40, 250) || !inRange(t.energy, 0, 10)) return null
  let artist: string | undefined
  if (t.artist !== undefined) {
    const a = text(t.artist, 200)
    if (!a) return null
    artist = a
  }
  return {
    hash: t.hash,
    title,
    ...(artist ? { artist } : {}),
    bpm: t.bpm,
    camelot: t.camelot,
    energy: t.energy,
  }
}

/**
 * Validate untrusted input (a request body on the server, a response in the app)
 * and return a clean copy with only known fields, or null if anything is off.
 */
export function parseSharedSet(input: unknown): SharedSet | null {
  if (typeof input !== 'object' || input === null) return null
  const s = input as Record<string, unknown>
  if (s.version !== SHARE_VERSION) return null
  const name = text(s.name, 80)
  if (!name) return null
  // Own keys only — `in` would also accept inherited names like 'toString'.
  if (typeof s.arc !== 'string' || !Object.hasOwn(ARC_LABELS, s.arc)) return null
  if (!inRange(s.flow, 0, 1)) return null
  if (!Array.isArray(s.tracks) || s.tracks.length < 2 || s.tracks.length > MAX_SHARED_TRACKS) {
    return null
  }
  const tracks: SharedTrack[] = []
  for (const raw of s.tracks) {
    const track = parseTrack(raw)
    if (!track) return null
    tracks.push(track)
  }
  if (
    !Array.isArray(s.transitions) ||
    s.transitions.length !== tracks.length - 1 ||
    !s.transitions.every((x) => inRange(x, 0, 1))
  ) {
    return null
  }
  return {
    version: SHARE_VERSION,
    name,
    arc: s.arc as ArcName,
    flow: s.flow,
    transitions: s.transitions as number[],
    tracks,
  }
}
