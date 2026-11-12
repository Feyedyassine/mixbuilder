import { afterEach, describe, expect, it } from 'vitest'
import { pickAudioDirectory } from '@/ingestion/pick'

// Minimal stand-ins for File System Access handles: enough for collectAudio.
function fileHandle(name: string) {
  return { kind: 'file' as const, name, getFile: async () => new File([new Uint8Array(4)], name) }
}
function dirHandle(name: string, entries: unknown[]) {
  return {
    kind: 'directory' as const,
    name,
    async *values() {
      yield* entries
    },
  }
}

type PickerWindow = { showDirectoryPicker?: () => Promise<unknown> }
const w = window as unknown as PickerWindow

afterEach(() => {
  delete w.showDirectoryPicker
})

describe('pickAudioDirectory', () => {
  it('records each file’s path within the picked folder, plus the folder name', async () => {
    const root = dirHandle('Techno', [
      fileHandle('a.mp3'),
      fileHandle('notes.txt'),
      dirHandle('Deep', [fileHandle('b.flac'), dirHandle('Old', [fileHandle('c.wav')])]),
    ])
    w.showDirectoryPicker = async () => root

    const picked = await pickAudioDirectory()

    expect(picked.map((p) => [p.relativePath, p.folder])).toEqual([
      ['a.mp3', 'Techno'],
      ['Deep/b.flac', 'Techno'],
      ['Deep/Old/c.wav', 'Techno'],
    ])
  })
})
