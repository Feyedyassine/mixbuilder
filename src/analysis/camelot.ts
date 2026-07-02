// Camelot-wheel mapping. Keyed by pitch class (0–11) so it's robust to enharmonic
// spellings (Essentia may return either sharps or flats).

const PITCH_CLASS: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
}

// Camelot number by pitch class.
const MAJOR_NUMBER = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1]
const MINOR_NUMBER = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10]

export function pitchClassOf(note: string): number | undefined {
  return PITCH_CLASS[note.trim()]
}

/**
 * Map a key + scale to its Camelot code (e.g. C major → "8B", A minor → "8A").
 * Returns an empty string for an unrecognized note.
 */
export function toCamelot(key: string, scale: 'major' | 'minor'): string {
  const pc = pitchClassOf(key)
  if (pc === undefined) return ''
  return scale === 'major' ? `${MAJOR_NUMBER[pc]}B` : `${MINOR_NUMBER[pc]}A`
}
