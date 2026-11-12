// Plain-text results for the BPM & key finder's "Copy results", e.g. to paste
// into notes, a spreadsheet or a message.

export interface FinderRow {
  title: string
  artist?: string
  camelot: string
  musicalKey: string
  bpm: number
}

export function finderResultsText(rows: FinderRow[]): string {
  return rows
    .map((r) => {
      const who = r.artist ? `${r.artist} – ${r.title}` : r.title
      const key = r.musicalKey ? `${r.camelot} (${r.musicalKey})` : r.camelot
      return `${who} — ${key}, ${Math.round(r.bpm)} BPM`
    })
    .join('\n')
}
