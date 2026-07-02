// Supported local audio formats (PRD F1: MP3, WAV, FLAC, AAC/M4A). A file is
// accepted if either its extension or its MIME type matches — pickers and drops
// don't always populate File.type reliably, so extension is the primary signal.

export const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.aac'] as const

const SUPPORTED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/aacp',
])

/** `accept` map for File System Access API pickers. */
export const FS_ACCESS_ACCEPT: Record<string, string[]> = {
  'audio/*': [...SUPPORTED_EXTENSIONS],
}

/** `accept` attribute string for the `<input type="file">` fallback. */
export const INPUT_ACCEPT = [...SUPPORTED_EXTENSIONS, 'audio/*'].join(',')

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

/** True when the file looks like a supported audio format. */
export function isSupportedAudioFile(file: { name: string; type?: string }): boolean {
  const ext = fileExtension(file.name)
  if ((SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) return true
  return file.type ? SUPPORTED_MIME_TYPES.has(file.type.toLowerCase()) : false
}
