import type { SetExport } from './types'
import { escapeXml } from './format'

// Rekordbox DJ_PLAYLISTS XML: a COLLECTION of tracks + an ordered PLAYLIST node.
// Location is a best-effort file URL from the bare filename — the browser has no
// absolute path, so Rekordbox may prompt to relocate files, but order, BPM and key
// import intact. (Import via Rekordbox → File → Import Playlist / rekordbox.xml.)

function trackElement(id: number, t: SetExport['tracks'][number]): string {
  const location = `file://localhost/${encodeURI(t.fileName)}`
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

export function toRekordboxXml(set: SetExport): string {
  const collection = set.tracks.map((t, i) => trackElement(i + 1, t))
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
