import { describe, expect, it } from 'vitest'
import { selectHashRanges } from '@/ingestion/hash'

describe('selectHashRanges', () => {
  const chunk = 2 * 1024 * 1024

  it('hashes the whole file when small enough', () => {
    expect(selectHashRanges(1000, chunk)).toEqual([{ start: 0, end: 1000 }])
  })

  it('hashes the whole file at exactly 2x chunk', () => {
    expect(selectHashRanges(chunk * 2, chunk)).toEqual([{ start: 0, end: chunk * 2 }])
  })

  it('hashes head and tail for large files', () => {
    const size = chunk * 5
    expect(selectHashRanges(size, chunk)).toEqual([
      { start: 0, end: chunk },
      { start: size - chunk, end: size },
    ])
  })

  it('never overlaps head and tail just past the threshold', () => {
    const size = chunk * 2 + 1
    const [head, tail] = selectHashRanges(size, chunk)
    expect(head!.end).toBeLessThanOrEqual(tail!.start)
  })
})
