import type { SetExport } from './types'

// Extended M3U8 playlist. URIs are bare filenames (the browser can't read absolute
// paths), so the playlist is portable when saved alongside the tracks — most
// players/DJ apps also match by filename. EXTINF carries duration + artist/title.

export function toM3U8(set: SetExport): string {
  const lines = ['#EXTM3U']
  for (const t of set.tracks) {
    const label = t.artist ? `${t.artist} - ${t.title}` : t.title
    lines.push(`#EXTINF:${Math.round(t.durationSec)},${label}`)
    lines.push(t.fileName)
  }
  return lines.join('\n') + '\n'
}
