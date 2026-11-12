// Camelot wheel reference data and harmonic-mixing moves, for the /tools/camelot-wheel
// page. Numbers are keys a fifth apart (like a clock); A = minor, B = major, and
// nA/nB share the same notes (relative keys).

export interface KeyName {
  /** Display name, e.g. "A minor". */
  name: string
  /** Short form, e.g. "Am". */
  short: string
  /** Enharmonic spelling some software shows instead, e.g. "G♯m". */
  alt?: string
}

export const CAMELOT_KEYS: Record<string, KeyName> = {
  '1A': { name: 'A♭ minor', short: 'A♭m', alt: 'G♯m' },
  '2A': { name: 'E♭ minor', short: 'E♭m', alt: 'D♯m' },
  '3A': { name: 'B♭ minor', short: 'B♭m', alt: 'A♯m' },
  '4A': { name: 'F minor', short: 'Fm' },
  '5A': { name: 'C minor', short: 'Cm' },
  '6A': { name: 'G minor', short: 'Gm' },
  '7A': { name: 'D minor', short: 'Dm' },
  '8A': { name: 'A minor', short: 'Am' },
  '9A': { name: 'E minor', short: 'Em' },
  '10A': { name: 'B minor', short: 'Bm' },
  '11A': { name: 'F♯ minor', short: 'F♯m', alt: 'G♭m' },
  '12A': { name: 'D♭ minor', short: 'D♭m', alt: 'C♯m' },
  '1B': { name: 'B major', short: 'B', alt: 'C♭' },
  '2B': { name: 'F♯ major', short: 'F♯', alt: 'G♭' },
  '3B': { name: 'D♭ major', short: 'D♭', alt: 'C♯' },
  '4B': { name: 'A♭ major', short: 'A♭', alt: 'G♯' },
  '5B': { name: 'E♭ major', short: 'E♭', alt: 'D♯' },
  '6B': { name: 'B♭ major', short: 'B♭', alt: 'A♯' },
  '7B': { name: 'F major', short: 'F' },
  '8B': { name: 'C major', short: 'C' },
  '9B': { name: 'G major', short: 'G' },
  '10B': { name: 'D major', short: 'D' },
  '11B': { name: 'A major', short: 'A' },
  '12B': { name: 'E major', short: 'E' },
}

export const WHEEL_NUMBERS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

export function isCamelotCode(value: string): boolean {
  return Object.hasOwn(CAMELOT_KEYS, value)
}

export function parseCamelot(code: string): { number: number; letter: 'A' | 'B' } | null {
  const m = /^(1[0-2]|[1-9])([AB])$/.exec(code.trim().toUpperCase())
  return m ? { number: Number(m[1]), letter: m[2] as 'A' | 'B' } : null
}

export type MoveKind = 'same' | 'up' | 'down' | 'relative' | 'diagonal' | 'jump' | 'semitone'

export interface Move {
  code: string
  kind: MoveKind
  /** Short tag shown on the wheel, e.g. "+1". */
  tag: string
  title: string
  detail: string
  /** 'safe' blends work almost anywhere; 'energy' moves are bolder, use with intent. */
  group: 'safe' | 'energy'
}

/** Wrap a wheel number into 1–12. */
const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1

/** Every key that mixes harmonically from `code`, safest first. Empty for an invalid code. */
export function compatibleMoves(code: string): Move[] {
  const key = parseCamelot(code)
  if (!key) return []
  const { number: n, letter } = key
  const other = letter === 'A' ? 'B' : 'A'
  const at = (num: number, l: string = letter) => `${wrap(num)}${l}`
  const minor = letter === 'A'

  return [
    {
      code: at(n),
      kind: 'same',
      tag: '=',
      title: 'Perfect match',
      detail: 'Same key: blends cleanly at any point in a set.',
      group: 'safe',
    },
    {
      code: at(n + 1),
      kind: 'up',
      tag: '+1',
      title: 'Lift',
      detail: 'One step clockwise: a smooth rise in energy.',
      group: 'safe',
    },
    {
      code: at(n - 1),
      kind: 'down',
      tag: '−1',
      title: 'Ease off',
      detail: 'One step counter-clockwise: calms the floor down.',
      group: 'safe',
    },
    {
      code: at(n, other),
      kind: 'relative',
      tag: minor ? 'maj' : 'min',
      title: minor ? 'Brighten (relative major)' : 'Darken (relative minor)',
      detail: 'Same notes, switches mood between minor and major.',
      group: 'safe',
    },
    minor
      ? {
          code: at(n + 1, other),
          kind: 'diagonal',
          tag: '↗',
          title: 'Diagonal lift',
          detail: 'Up a step and into major: an uplifting, bright change.',
          group: 'energy',
        }
      : {
          code: at(n - 1, other),
          kind: 'diagonal',
          tag: '↙',
          title: 'Diagonal drop',
          detail: 'Down a step and into minor: a moodier, darker turn.',
          group: 'energy',
        },
    {
      code: at(n + 2),
      kind: 'jump',
      tag: '+2',
      title: 'Energy jump',
      detail: 'Two steps clockwise: a bigger lift. Keep the blend short.',
      group: 'energy',
    },
    {
      code: at(n + 7),
      kind: 'semitone',
      tag: '+7',
      title: 'Semitone boost',
      detail: 'Up one semitone: the classic key-change lift. Mix quickly, on a phrase.',
      group: 'energy',
    },
  ]
}
