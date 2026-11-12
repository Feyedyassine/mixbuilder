import type { TrackFeatures } from '@/analysis/feature-schema'
import type { TrackFile } from '@/ingestion/types'

// Hands tracks analyzed by a tool page (e.g. the BPM & key finder) to the set
// builder, files and analysis together, so nothing is re-picked or re-analyzed.
// The builder registers itself as the receiver while mounted.

export interface TrackHandoff {
  tracks: TrackFile[]
  analyses: Record<string, TrackFeatures | { error: true }>
}

let receiver: ((handoff: TrackHandoff) => void) | null = null

export function registerTrackReceiver(fn: ((handoff: TrackHandoff) => void) | null): void {
  receiver = fn
}

export function handOffTracks(handoff: TrackHandoff): void {
  receiver?.(handoff)
}
