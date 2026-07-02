import { FS_ACCESS_ACCEPT, INPUT_ACCEPT, isSupportedAudioFile } from './supported'

export interface PickedFile {
  file: File
  handle?: FileSystemFileHandle
}

// The File System Access API isn't in every TS lib.dom, so we access its entry
// points through a narrow typed view of window rather than global augmentation.
interface FileSystemAccessWindow {
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    excludeAcceptAllOption?: boolean
    types?: { description?: string; accept: Record<string, string[]> }[]
  }) => Promise<FileSystemFileHandle[]>
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}

function fsAccess(): FileSystemAccessWindow {
  return window as unknown as FileSystemAccessWindow
}

/** Chrome/Edge expose the File System Access API; Firefox/Safari fall back. */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof fsAccess().showOpenFilePicker === 'function'
}

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && typeof fsAccess().showDirectoryPicker === 'function'
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Prompt the user to select one or more audio files. */
export async function pickAudioFiles(): Promise<PickedFile[]> {
  const showOpenFilePicker = fsAccess().showOpenFilePicker
  if (!showOpenFilePicker) return pickViaInput()

  let handles: FileSystemFileHandle[]
  try {
    handles = await showOpenFilePicker({
      multiple: true,
      types: [{ description: 'Audio', accept: FS_ACCESS_ACCEPT }],
    })
  } catch (error) {
    if (isAbort(error)) return []
    throw error
  }

  const picked = await Promise.all(
    handles.map(async (handle) => ({ file: await handle.getFile(), handle })),
  )
  return picked.filter(({ file }) => isSupportedAudioFile(file))
}

/** Prompt for a folder and collect supported audio recursively (Chrome/Edge only). */
export async function pickAudioDirectory(): Promise<PickedFile[]> {
  const showDirectoryPicker = fsAccess().showDirectoryPicker
  if (!showDirectoryPicker) return pickViaInput()

  let dir: FileSystemDirectoryHandle
  try {
    dir = await showDirectoryPicker()
  } catch (error) {
    if (isAbort(error)) return []
    throw error
  }

  const out: PickedFile[] = []
  await collectAudio(dir, out)
  return out
}

async function collectAudio(dir: FileSystemDirectoryHandle, out: PickedFile[]): Promise<void> {
  // values() is a standard async iterator on the directory handle.
  for await (const entry of dir.values()) {
    if (entry.kind === 'file') {
      const handle = entry
      const file = await handle.getFile()
      if (isSupportedAudioFile(file)) out.push({ file, handle })
    } else {
      await collectAudio(entry, out)
    }
  }
}

function pickViaInput(): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = INPUT_ACCEPT
    input.addEventListener('cancel', () => resolve([]))
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []).filter((f) => isSupportedAudioFile(f))
      resolve(files.map((file) => ({ file })))
    })
    input.click()
  })
}
