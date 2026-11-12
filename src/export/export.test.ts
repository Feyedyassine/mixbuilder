import { describe, expect, it } from 'vitest'
import type { SetExport } from '@/export/types'
import { toM3U8 } from '@/export/m3u8'
import { toRekordboxXml } from '@/export/rekordbox'
import { toSetSheet } from '@/export/setsheet'
import { buildSetExport } from '@/export/build'
import { safeFileStem } from '@/export/download'
import { parseMusicFolder } from '@/export/paths'
import { optimizeSet, type AnalyzedTrack } from '@/sequencing/sequencer'
import { makeTrack } from '@/sequencing/fixtures'

const SAMPLE: SetExport = {
  name: 'Friday Warmup',
  arcLabel: 'Warm-up',
  flowPct: 82,
  tracks: [
    {
      fileName: 'a.mp3',
      relativePath: 'a.mp3',
      title: 'Glue',
      artist: 'Bicep',
      bpm: 124,
      camelot: '8A',
      musicalKey: 'Am',
      durationSec: 300,
    },
    {
      fileName: 'b & c.mp3',
      relativePath: 'Deep/b & c.mp3',
      title: 'Tou<ch>',
      artist: 'A & B',
      bpm: 126,
      camelot: '9A',
      musicalKey: 'Em',
      durationSec: 320,
    },
  ],
  transitions: [
    {
      scorePct: 88,
      warnings: ['Bass conflict'],
      fromOutroStartSec: 255,
      fromOutroEndSec: 300,
      toIntroStartSec: 0,
      toIntroEndSec: 45,
    },
  ],
}

describe('toM3U8', () => {
  it('emits EXTM3U with EXTINF and filenames in order', () => {
    const out = toM3U8(SAMPLE)
    expect(out.startsWith('#EXTM3U')).toBe(true)
    expect(out).toContain('#EXTINF:300,Bicep - Glue')
    expect(out.indexOf('a.mp3')).toBeLessThan(out.indexOf('b & c.mp3'))
  })

  it('without a music folder, lists paths relative to it (subfolders kept)', () => {
    const lines = toM3U8(SAMPLE).trim().split('\n')
    expect(lines.filter((l) => !l.startsWith('#'))).toEqual(['a.mp3', 'Deep/b & c.mp3'])
  })

  it('with a music folder, lists absolute native paths', () => {
    const lines = toM3U8(SAMPLE, parseMusicFolder('C:\\DJ\\Techno')).trim().split('\n')
    expect(lines.filter((l) => !l.startsWith('#'))).toEqual([
      'C:\\DJ\\Techno\\a.mp3',
      'C:\\DJ\\Techno\\Deep\\b & c.mp3',
    ])
  })
})

describe('toRekordboxXml', () => {
  it('produces a collection + ordered playlist with escaped metadata', () => {
    const xml = toRekordboxXml(SAMPLE)
    expect(xml).toContain('<DJ_PLAYLISTS Version="1.0.0">')
    expect(xml).toContain('AverageBpm="124.00"')
    expect(xml).toContain('Tonality="Am"')
    // XML special chars are escaped.
    expect(xml).toContain('Tou&lt;ch&gt;')
    expect(xml).toContain('A &amp; B')
    // Location is URL-encoded per segment, so no raw '&' breaks the XML.
    expect(xml).toContain('Location="file://localhost/Deep/b%20%26%20c.mp3"')
    expect(xml).not.toMatch(/Location="[^"]*&[^"]*"/)
    // Playlist references both tracks in order.
    expect(xml).toContain('<TRACK Key="1"/>')
    expect(xml).toContain('<TRACK Key="2"/>')
    expect(xml).toContain('Entries="2"')
  })
})

describe('toRekordboxXml with a music folder', () => {
  it('points Location at the real file', () => {
    const mac = toRekordboxXml(SAMPLE, parseMusicFolder('/Users/me/Music'))
    expect(mac).toContain('Location="file://localhost/Users/me/Music/a.mp3"')
    expect(mac).toContain('Location="file://localhost/Users/me/Music/Deep/b%20%26%20c.mp3"')
    const win = toRekordboxXml(SAMPLE, parseMusicFolder('"C:\\My Music"'))
    expect(win).toContain('Location="file://localhost/C:/My%20Music/a.mp3"')
  })
})

describe('toSetSheet', () => {
  it('lists tracks with meta, mix windows and warnings', () => {
    const md = toSetSheet(SAMPLE)
    expect(md).toContain('# Friday Warmup')
    expect(md).toContain('1. **Bicep — Glue**')
    expect(md).toContain('124 BPM · 8A')
    expect(md).toContain('4:15–5:00 → 0:00–0:45')
    expect(md).toContain('⚠ Bass conflict')
  })
})

describe('buildSetExport', () => {
  it('maps a SequencedSet + display info into a SetExport', () => {
    const tracks: AnalyzedTrack[] = [
      { id: 'h1', features: makeTrack({ bpm: 124, camelot: '8A', key: 'A', scale: 'minor' }) },
      { id: 'h2', features: makeTrack({ bpm: 125, camelot: '9A', key: 'E', scale: 'minor' }) },
      { id: 'h3', features: makeTrack({ bpm: 123, camelot: '7A' }) },
    ]
    const set = optimizeSet(tracks, { seed: 1 })
    const display = new Map([
      ['h1', { fileName: 'one.mp3', title: 'One', artist: 'X' }],
      ['h2', { fileName: 'two.mp3', title: 'Two' }],
    ])
    const exp = buildSetExport(set, display, 'My Set')
    expect(exp.tracks).toHaveLength(3)
    expect(exp.transitions).toHaveLength(2)
    expect(exp.tracks.find((t) => t.fileName === 'one.mp3')?.musicalKey).toBe('Am')
    // Missing display info falls back without throwing.
    expect(exp.tracks.some((t) => t.fileName === 'h3.mp3')).toBe(true)
  })
})

describe('safeFileStem', () => {
  it('slugs unsafe characters and never returns empty', () => {
    expect(safeFileStem('Friday / Warmup!')).toBe('Friday-Warmup')
    expect(safeFileStem('   ')).toBe('mixbuilder-set')
  })
})
