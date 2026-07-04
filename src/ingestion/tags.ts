import type { TrackTags } from './types'
import { fileExtension } from './supported'

// Tags are display-only (PRD F1: never trusted for analysis). Reading is
// best-effort: music-metadata is lazy-loaded so it stays out of the initial
// bundle, and any parse failure falls back to filename-derived tags.

/**
 * Derive a title (and possibly artist) from a filename. Recognizes the common
 * "Artist - Title" convention; otherwise the whole stem is the title.
 */
export function tagsFromFilename(name: string): TrackTags {
  const stem = name.slice(0, name.length - fileExtension(name).length) || name
  const dash = stem.indexOf(' - ')
  if (dash !== -1) {
    const artist = stem.slice(0, dash).trim()
    const title = stem.slice(dash + 3).trim()
    if (artist && title) return { artist, title }
  }
  return { title: stem.trim() }
}

export async function readTags(file: File): Promise<TrackTags> {
  const fallback = tagsFromFilename(file.name)
  try {
    const { parseBlob } = await import('music-metadata')
    const { common } = await parseBlob(file, { duration: false })
    const pic = common.picture?.[0]
    // Embedded art stays on-device: we just wrap the bytes in an object URL.
    const cover = pic
      ? URL.createObjectURL(
          new Blob([new Uint8Array(pic.data)], { type: pic.format || 'image/jpeg' }),
        )
      : undefined
    return {
      title: common.title ?? fallback.title,
      artist: common.artist ?? fallback.artist,
      bpm: typeof common.bpm === 'number' ? common.bpm : undefined,
      key: common.key,
      ...(cover ? { cover } : {}),
    }
  } catch {
    return fallback
  }
}
