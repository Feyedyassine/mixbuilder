// The user's music-folder path (as typed/pasted), remembered in this browser so
// exports keep pointing at real files. Lives in localStorage: it's one small string
// and needs to be readable synchronously when the Export panel opens.

const KEY = 'mb-music-folder'

export function loadMusicFolderInput(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveMusicFolderInput(value: string): void {
  try {
    if (value.trim()) localStorage.setItem(KEY, value)
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: the path just isn't remembered.
  }
}
