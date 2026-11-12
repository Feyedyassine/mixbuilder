import type { SetExport } from './types'
import { playlistPath, type MusicFolder } from './paths'

// Extended M3U8 playlist (UTF-8). With the user's music folder, entries are
// absolute paths that Serato, Traktor, VirtualDJ, Rekordbox etc. open directly;
// without it they're relative to that folder, so the playlist works when saved
// inside it. EXTINF carries duration + artist/title.

export function toM3U8(set: SetExport, folder: MusicFolder | null = null): string {
  const lines = ['#EXTM3U']
  for (const t of set.tracks) {
    const label = t.artist ? `${t.artist} - ${t.title}` : t.title
    lines.push(`#EXTINF:${Math.round(t.durationSec)},${label}`)
    lines.push(playlistPath(folder, t.relativePath))
  }
  return lines.join('\n') + '\n'
}
