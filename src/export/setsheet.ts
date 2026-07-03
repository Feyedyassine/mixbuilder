import type { SetExport } from './types'
import { formatTime } from './format'

// Human-readable set sheet (Markdown) — order, keys, BPMs, suggested mix windows,
// and transition warnings. Prints cleanly or converts to PDF.

export function toSetSheet(set: SetExport): string {
  const lines: string[] = [
    `# ${set.name}`,
    '',
    `${set.arcLabel} set · ${set.tracks.length} tracks · flow ${set.flowPct}%`,
    '',
  ]

  set.tracks.forEach((t, i) => {
    const meta = [`${t.bpm.toFixed(0)} BPM`, t.camelot || t.musicalKey].filter(Boolean).join(' · ')
    const who = t.artist ? `${t.artist} — ${t.title}` : t.title
    lines.push(`${i + 1}. **${who}**  \`${meta}\``)

    const tr = set.transitions[i]
    if (tr) {
      const window = `${formatTime(tr.fromOutroStartSec)}–${formatTime(tr.fromOutroEndSec)} → ${formatTime(tr.toIntroStartSec)}–${formatTime(tr.toIntroEndSec)}`
      const warn = tr.warnings.length ? ` — ⚠ ${tr.warnings.join(', ')}` : ''
      lines.push(`   ↳ mix ${tr.scorePct}% · ${window}${warn}`)
    }
  })

  lines.push('')
  return lines.join('\n')
}
