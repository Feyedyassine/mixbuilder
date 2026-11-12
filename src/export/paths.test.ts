import { describe, expect, it } from 'vitest'
import { absolutePath, fileUrl, parseMusicFolder, playlistPath } from '@/export/paths'

describe('parseMusicFolder', () => {
  it.each([
    ['C:\\Users\\me\\Music', 'windows', ['Users', 'me', 'Music'], 'C:'],
    ['"C:\\Users\\me\\My Music\\"', 'windows', ['Users', 'me', 'My Music'], 'C:'], // Explorer "Copy as path"
    ['d:/DJ/Techno/', 'windows', ['DJ', 'Techno'], 'D:'],
    ['  /Users/me/Music/  ', 'posix', ['Users', 'me', 'Music'], undefined],
    ["'/home/me/Music'", 'posix', ['home', 'me', 'Music'], undefined],
  ])('parses %s', (input, style, segments, drive) => {
    expect(parseMusicFolder(input)).toEqual({ style, segments, ...(drive ? { drive } : {}) })
  })

  it.each(['', 'Music', '~/Music', 'Users\\me', 'http://x'])('rejects %j', (input) => {
    expect(parseMusicFolder(input)).toBeNull()
  })
})

describe('absolutePath / playlistPath', () => {
  const win = parseMusicFolder('C:\\Users\\me\\Music')!
  const mac = parseMusicFolder('/Users/me/Music')!

  it('joins with the native separator, including subfolders', () => {
    expect(absolutePath(win, 'Deep/a b.mp3')).toBe('C:\\Users\\me\\Music\\Deep\\a b.mp3')
    expect(absolutePath(mac, 'Deep/a b.mp3')).toBe('/Users/me/Music/Deep/a b.mp3')
  })

  it('never escapes the folder', () => {
    expect(absolutePath(mac, '../../etc/x.mp3')).toBe('/Users/me/Music/etc/x.mp3')
  })

  it('falls back to the relative path without a folder', () => {
    expect(playlistPath(null, 'Deep/a.mp3')).toBe('Deep/a.mp3')
    expect(playlistPath(win, 'a.mp3')).toBe('C:\\Users\\me\\Music\\a.mp3')
  })
})

describe('fileUrl (rekordbox Location)', () => {
  it('writes file://localhost/C:/… on Windows, keeping the drive colon', () => {
    const win = parseMusicFolder('C:\\DJ Music')!
    expect(fileUrl(win, 'Deep/Bicep - Glue.mp3')).toBe(
      'file://localhost/C:/DJ%20Music/Deep/Bicep%20-%20Glue.mp3',
    )
  })

  it('writes file://localhost/Users/… on macOS', () => {
    expect(fileUrl(parseMusicFolder('/Users/me/Music')!, 'a.mp3')).toBe(
      'file://localhost/Users/me/Music/a.mp3',
    )
  })

  it('percent-encodes reserved and non-ASCII characters per segment', () => {
    expect(fileUrl(parseMusicFolder('/M')!, 'Röyksopp & Robyn #1 100%.mp3')).toBe(
      'file://localhost/M/R%C3%B6yksopp%20%26%20Robyn%20%231%20100%25.mp3',
    )
  })

  it('stays relative-ish without a folder (rekordbox will ask to relocate)', () => {
    expect(fileUrl(null, 'a b.mp3')).toBe('file://localhost/a%20b.mp3')
  })
})
