import { describe, expect, it } from 'vitest'

import { describeBytes, sourceAnchorText, toSourceRows } from './source-rows'

describe('toSourceRows', () => {
  it('numbers lines from one', () => {
    expect(toSourceRows('a\nb\nc')).toEqual([
      { key: '1', line: 1, text: 'a' },
      { key: '2', line: 2, text: 'b' },
      { key: '3', line: 3, text: 'c' },
    ])
  })

  it('treats a trailing newline as a terminator, not an empty last line', () => {
    expect(toSourceRows('a\nb\n')).toHaveLength(2)
  })

  it('keeps blank lines inside the file', () => {
    expect(toSourceRows('a\n\nb').map((row) => row.text)).toEqual(['a', '', 'b'])
  })

  it('has no rows for an empty file', () => {
    expect(toSourceRows('')).toEqual([])
  })

  it('renders a file with no trailing newline whole', () => {
    expect(toSourceRows('only')).toEqual([{ key: '1', line: 1, text: 'only' }])
  })

  it('keys rows uniquely, so the list never collapses two lines into one', () => {
    const rows = toSourceRows('x\nx\nx')
    expect(new Set(rows.map((row) => row.key)).size).toBe(3)
  })
})

describe('sourceAnchorText', () => {
  const rows = toSourceRows('one\ntwo\nthree\nfour')

  it('quotes exactly the lines the range covers, both bounds included', () => {
    expect(sourceAnchorText(rows, { endLine: 3, startLine: 2 })).toBe('two\nthree')
  })

  it('quotes one line for a one-line range', () => {
    expect(sourceAnchorText(rows, { endLine: 1, startLine: 1 })).toBe('one')
  })

  it('returns empty text for a range past the end of the file', () => {
    expect(sourceAnchorText(rows, { endLine: 99, startLine: 90 })).toBe('')
  })

  it('caps the quote — it is context for the agent, not the file', () => {
    const long = toSourceRows(Array.from({ length: 500 }, () => 'x'.repeat(50)).join('\n'))
    expect(sourceAnchorText(long, { endLine: 500, startLine: 1 })).toHaveLength(2_000)
  })
})

describe('describeBytes', () => {
  it('reports small files in bytes', () => {
    expect(describeBytes(512)).toBe('512 B')
  })

  it('switches to KB at a kilobyte', () => {
    expect(describeBytes(1536)).toBe('1.5 KB')
  })

  it('switches to MB at a megabyte', () => {
    expect(describeBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})
