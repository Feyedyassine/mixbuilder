import { useState } from 'react'
import { parseMusicFolder, type MusicFolder } from '@/export/paths'
import { loadMusicFolderInput, saveMusicFolderInput } from '@/storage/music-folder'

// Export options. Browsers can't see where files live, so the user pastes their
// music folder's path once (remembered); playlist exports then point straight at
// the files instead of making the DJ software search for them.

export type ExportKind = 'm3u8' | 'rekordbox' | 'sheet'

type Platform = 'windows' | 'mac' | 'other'

function platform(): Platform {
  const ua = navigator.userAgent
  return /Windows/i.test(ua) ? 'windows' : /Macintosh|Mac OS X/i.test(ua) ? 'mac' : 'other'
}

const EXAMPLE: Record<Platform, string> = {
  windows: 'C:\\Users\\you\\Music',
  mac: '/Users/you/Music',
  other: '/home/you/Music',
}

const COPY_TIP: Record<Platform, string> = {
  windows: 'In File Explorer, Shift + right-click the folder → “Copy as path”.',
  mac: 'In Finder, right-click the folder, hold Option → “Copy … as Pathname”.',
  other: 'Copy the folder’s full path from your file manager.',
}

const FORMATS: { kind: ExportKind; title: string; detail: string }[] = [
  {
    kind: 'rekordbox',
    title: 'Rekordbox XML',
    detail: 'Preferences → Advanced → Database → rekordbox xml',
  },
  { kind: 'm3u8', title: 'M3U8 playlist', detail: 'Serato, Traktor, VirtualDJ and more' },
  { kind: 'sheet', title: 'Set sheet', detail: 'Printable tracklist with keys and mix notes' },
]

export default function ExportPanel({
  folders,
  onExport,
}: {
  /** Names of the folders the set's tracks were added from (via "Add folder"). */
  folders: string[]
  onExport: (kind: ExportKind, folder: MusicFolder | null) => void
}) {
  const [input, setInput] = useState(loadMusicFolderInput)
  const folder = parseMusicFolder(input)
  const os = platform()

  const change = (value: string) => {
    setInput(value)
    saveMusicFolderInput(value)
  }

  const which =
    folders.length === 1 ? `your “${folders[0]}” folder` : 'the folder your tracks are in'

  return (
    <div className="space-y-3 p-3">
      <div>
        <label htmlFor="music-folder" className="text-xs font-semibold text-neutral-200">
          Where are these tracks on your computer?
        </label>
        <input
          id="music-folder"
          value={input}
          onChange={(e) => change(e.target.value)}
          placeholder={EXAMPLE[os]}
          spellCheck={false}
          autoComplete="off"
          className="mt-1.5 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-xs text-neutral-200 outline-none focus:border-neutral-600"
        />
        {input.trim() && !folder ? (
          <p className="mt-1 text-[11px] text-red-400">Paste the full path, e.g. {EXAMPLE[os]}</p>
        ) : (
          <p className="mt-1 text-[11px] text-neutral-500">
            Paste the full path of {which}. {COPY_TIP[os]}
          </p>
        )}
      </div>

      <div className="space-y-0.5">
        {FORMATS.map((f) => (
          <button
            key={f.kind}
            className="block w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-neutral-800"
            onClick={() => onExport(f.kind, folder)}
          >
            <span className="block text-sm text-neutral-200">{f.title}</span>
            <span className="block text-[11px] text-neutral-500">{f.detail}</span>
          </button>
        ))}
      </div>

      {!folder && (
        <p className="text-[11px] text-signal-500">
          Without the folder path, save the M3U8 inside that folder; rekordbox will ask you to
          locate the tracks.
        </p>
      )}
    </div>
  )
}
