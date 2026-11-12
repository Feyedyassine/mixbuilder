import type { SetExport } from './types'
import { escapeXml } from './format'
import { fileUrl, type MusicFolder } from './paths'

// Rekordbox DJ_PLAYLISTS XML: a COLLECTION of tracks + an ordered PLAYLIST node.
// With the user's music folder, Location is the track's real file URL and
// Rekordbox links the files directly; without it, Rekordbox asks to relocate them
// (order, BPM and key still import). In rekordbox, select the file under
// Preferences → Advanced → Database → rekordbox xml; it appears in the sidebar.

function trackElement(
  id: number,
  t: SetExport['tracks'][number],
  folder: MusicFolder | null,
): string {
  const location = escapeXml(fileUrl(folder, t.relativePath))
  const attrs = [
    `TrackID="${id}"`,
    `Name="${escapeXml(t.title)}"`,
    `Artist="${escapeXml(t.artist ?? '')}"`,
    `AverageBpm="${t.bpm.toFixed(2)}"`,
    `Tonality="${escapeXml(t.musicalKey)}"`,
    `TotalTime="${Math.round(t.durationSec)}"`,
    `Location="${location}"`,
  ]
  return `      <TRACK ${attrs.join(' ')}/>`
}

export function toRekordboxXml(set: SetExport, folder: MusicFolder | null = null): string {
  const collection = set.tracks.map((t, i) => trackElement(i + 1, t, folder))
  const playlistRefs = set.tracks.map((_, i) => `        <TRACK Key="${i + 1}"/>`)

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<DJ_PLAYLISTS Version="1.0.0">',
    '  <PRODUCT Name="mixbuilder" Version="0.1.0" Company="mixbuilder"/>',
    `  <COLLECTION Entries="${set.tracks.length}">`,
    ...collection,
    '  </COLLECTION>',
    '  <PLAYLISTS>',
    '    <NODE Type="0" Name="ROOT" Count="1">',
    `      <NODE Name="${escapeXml(set.name)}" Type="1" KeyType="0" Entries="${set.tracks.length}">`,
    ...playlistRefs,
    '      </NODE>',
    '    </NODE>',
    '  </PLAYLISTS>',
    '</DJ_PLAYLISTS>',
    '',
  ].join('\n')
}
