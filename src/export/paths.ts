// Turning a track's location into something DJ software can open. Browsers never
// reveal where a file lives on disk, so the user pastes their music folder's full
// path once; each track contributes its path *within* that folder (subfolders
// included when added with "Add folder"). Without a folder, writers fall back to
// that relative path — correct when the playlist is saved inside the folder.

export interface MusicFolder {
  style: 'windows' | 'posix'
  /** Drive letter with colon ("C:") on Windows paths. */
  drive?: string
  segments: string[]
}

/**
 * Parse a pasted absolute folder path (Windows "C:\…" or POSIX "/…"). Tolerates
 * surrounding quotes (Explorer's "Copy as path" adds them), whitespace and
 * trailing separators. Returns null for anything that isn't an absolute path.
 */
export function parseMusicFolder(input: string): MusicFolder | null {
  const raw = input
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
  const win = /^([A-Za-z]:)[\\/]*(.*)$/.exec(raw)
  if (win) {
    return { style: 'windows', drive: win[1]!.toUpperCase(), segments: split(win[2]!) }
  }
  if (raw.startsWith('/')) return { style: 'posix', segments: split(raw) }
  return null
}

function split(path: string): string[] {
  return path.split(/[\\/]+/).filter((s) => s.length > 0 && s !== '.')
}

/** Relative path segments, dropping anything that would escape the folder. */
function relativeSegments(relativePath: string): string[] {
  return split(relativePath).filter((s) => s !== '..')
}

/** OS-native absolute path, e.g. "C:\Music\Deep\x.mp3" or "/Users/me/Music/x.mp3". */
export function absolutePath(folder: MusicFolder, relativePath: string): string {
  const parts = [...folder.segments, ...relativeSegments(relativePath)]
  return folder.style === 'windows' ? `${folder.drive}\\${parts.join('\\')}` : `/${parts.join('/')}`
}

/**
 * file:// URL in the form Rekordbox writes and reads: "file://localhost/C:/…" on
 * Windows, "file://localhost/Users/…" on macOS. Each segment is percent-encoded.
 */
export function fileUrl(folder: MusicFolder | null, relativePath: string): string {
  const parts = [...(folder?.segments ?? []), ...relativeSegments(relativePath)].map(
    encodeURIComponent,
  )
  if (folder?.drive) parts.unshift(folder.drive)
  return `file://localhost/${parts.join('/')}`
}

/** The playlist entry for a track: absolute when a folder is known, else relative. */
export function playlistPath(folder: MusicFolder | null, relativePath: string): string {
  return folder ? absolutePath(folder, relativePath) : relativeSegments(relativePath).join('/')
}
