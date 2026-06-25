import { describe, expect, it } from 'vitest'
import {
  createMessageBuffer,
  encodeMessage,
  toDiagnostics,
  toHoverInfo,
  toSymbolLocations,
} from './lsp'

// Build the wire bytes for an object the way a server would frame it, so the buffer
// tests can chop them at arbitrary boundaries.
function framed(obj: object): string {
  return encodeMessage(obj)
}

describe('encodeMessage', () => {
  it('frames with a Content-Length header and blank-line separator', () => {
    const out = encodeMessage({ a: 1 })
    expect(out).toBe('Content-Length: 7\r\n\r\n{"a":1}')
  })

  it('counts BYTES, not characters, for multibyte bodies', () => {
    const out = encodeMessage({ s: '日本' }) // 日本 = 6 UTF-8 bytes
    const body = '{"s":"日本"}'
    expect(out).toBe(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`)
    // sanity: the body is 14 bytes (8 ascii chars + 6 for the two 3-byte CJK chars),
    // but only 10 JS characters — the header must report the byte count, not length.
    expect(body.length).toBe(10)
    expect(Buffer.byteLength(body, 'utf8')).toBe(14)
    expect(out).toContain('Content-Length: 14\r\n\r\n')
  })
})

describe('createMessageBuffer', () => {
  it('decodes a single complete message', () => {
    const buf = createMessageBuffer()
    expect(buf.push(framed({ id: 1, result: 'ok' }))).toEqual([{ id: 1, result: 'ok' }])
  })

  it('handles a header split across two chunks', () => {
    const buf = createMessageBuffer()
    const wire = framed({ id: 2, result: 42 })
    const splitAt = 8 // mid-header ("Content-")
    expect(buf.push(wire.slice(0, splitAt))).toEqual([])
    expect(buf.push(wire.slice(splitAt))).toEqual([{ id: 2, result: 42 }])
  })

  it('handles a body split across two chunks', () => {
    const buf = createMessageBuffer()
    const wire = framed({ id: 3, result: { deep: 'value' } })
    const headerEnd = wire.indexOf('\r\n\r\n') + 4
    const splitAt = headerEnd + 3 // a few bytes into the body
    expect(buf.push(wire.slice(0, splitAt))).toEqual([])
    expect(buf.push(wire.slice(splitAt))).toEqual([{ id: 3, result: { deep: 'value' } }])
  })

  it('decodes two messages packed into one chunk', () => {
    const buf = createMessageBuffer()
    const wire = framed({ id: 1, result: 'a' }) + framed({ id: 2, result: 'b' })
    expect(buf.push(wire)).toEqual([
      { id: 1, result: 'a' },
      { id: 2, result: 'b' },
    ])
  })

  it('carries a trailing partial message to the next push', () => {
    const buf = createMessageBuffer()
    const first = framed({ id: 1, result: 'a' })
    const second = framed({ id: 2, result: 'b' })
    const wire = first + second
    const splitAt = first.length + 5 // first whole, second partial
    expect(buf.push(wire.slice(0, splitAt))).toEqual([{ id: 1, result: 'a' }])
    expect(buf.push(wire.slice(splitAt))).toEqual([{ id: 2, result: 'b' }])
  })

  it('handles a large multibyte body chunked at byte boundaries', () => {
    const buf = createMessageBuffer()
    const big = '✓'.repeat(5000) // 3 bytes each → 15000-byte body region
    const wire = Buffer.from(framed({ id: 9, result: big }), 'utf8')
    // Feed it 64 bytes at a time, possibly slicing through a multibyte char.
    const out: object[] = []
    for (let i = 0; i < wire.length; i += 64) {
      out.push(...buf.push(wire.subarray(i, i + 64)))
    }
    expect(out).toEqual([{ id: 9, result: big }])
  })

  it('accepts Buffer chunks directly', () => {
    const buf = createMessageBuffer()
    expect(buf.push(Buffer.from(framed({ id: 7, result: 1 }), 'utf8'))).toEqual([
      { id: 7, result: 1 },
    ])
  })
})

describe('toHoverInfo', () => {
  it('reads a MarkupContent { kind, value }', () => {
    expect(toHoverInfo({ contents: { kind: 'markdown', value: '`const x: number`' } })).toEqual({
      markdown: '`const x: number`',
    })
  })

  it('reads a plain marked string', () => {
    expect(toHoverInfo({ contents: 'just text' })).toEqual({ markdown: 'just text' })
  })

  it('reads a { language, value } marked string as a fenced block', () => {
    expect(toHoverInfo({ contents: { language: 'ts', value: 'const x = 1' } })).toEqual({
      markdown: '```ts\nconst x = 1\n```',
    })
  })

  it('joins an array of marked strings with newlines', () => {
    expect(toHoverInfo({ contents: ['line one', { language: 'ts', value: 'x' }] })).toEqual({
      markdown: 'line one\n```ts\nx\n```',
    })
  })

  it('returns null for null/undefined hover', () => {
    expect(toHoverInfo(null)).toBeNull()
    expect(toHoverInfo(undefined)).toBeNull()
    expect(toHoverInfo({})).toBeNull()
  })

  it('returns null for empty/whitespace content', () => {
    expect(toHoverInfo({ contents: '' })).toBeNull()
    expect(toHoverInfo({ contents: '   \n  ' })).toBeNull()
    expect(toHoverInfo({ contents: { kind: 'markdown', value: '' } })).toBeNull()
  })
})

describe('toSymbolLocations', () => {
  const range = {
    start: { line: 1, character: 2 },
    end: { line: 1, character: 8 },
  }

  it('converts a single Location, decoding the file:// uri to an fs path', () => {
    expect(toSymbolLocations({ uri: 'file:///Users/me/repo/src/a.ts', range })).toEqual([
      { path: '/Users/me/repo/src/a.ts', line: 1, character: 2, endLine: 1, endCharacter: 8 },
    ])
  })

  it('converts a Location[] array', () => {
    const out = toSymbolLocations([
      { uri: 'file:///a.ts', range },
      { uri: 'file:///b.ts', range },
    ])
    expect(out.map((s) => s.path)).toEqual(['/a.ts', '/b.ts'])
  })

  it('converts a LocationLink[] using targetSelectionRange', () => {
    const out = toSymbolLocations([
      {
        targetUri: 'file:///c.ts',
        targetSelectionRange: { start: { line: 3, character: 0 }, end: { line: 3, character: 5 } },
        targetRange: { start: { line: 0, character: 0 }, end: { line: 9, character: 0 } },
      },
    ])
    expect(out).toEqual([{ path: '/c.ts', line: 3, character: 0, endLine: 3, endCharacter: 5 }])
  })

  it('falls back to targetRange when no selection range', () => {
    const out = toSymbolLocations([
      {
        targetUri: 'file:///d.ts',
        targetRange: { start: { line: 4, character: 1 }, end: { line: 4, character: 9 } },
      },
    ])
    expect(out).toEqual([{ path: '/d.ts', line: 4, character: 1, endLine: 4, endCharacter: 9 }])
  })

  it('decodes percent-encoded uris', () => {
    const out = toSymbolLocations({ uri: 'file:///a%20b/c.ts', range })
    expect(out[0]?.path).toBe('/a b/c.ts')
  })

  it('drops non-file uris and returns [] for null/undefined', () => {
    expect(toSymbolLocations(null)).toEqual([])
    expect(toSymbolLocations(undefined)).toEqual([])
    expect(toSymbolLocations({ uri: 'untitled:foo', range })).toEqual([])
  })
})

describe('toDiagnostics', () => {
  const baseRange = {
    start: { line: 5, character: 3 },
    end: { line: 5, character: 10 },
  }

  it('maps severity codes 1..4 to labels', () => {
    const out = toDiagnostics([
      { range: baseRange, severity: 1, message: 'e' },
      { range: baseRange, severity: 2, message: 'w' },
      { range: baseRange, severity: 3, message: 'i' },
      { range: baseRange, severity: 4, message: 'h' },
    ])
    expect(out.map((d) => d.severity)).toEqual(['error', 'warning', 'info', 'hint'])
  })

  it('defaults an absent/unknown severity to error', () => {
    expect(toDiagnostics([{ range: baseRange, message: 'x' }])[0]?.severity).toBe('error')
    expect(toDiagnostics([{ range: baseRange, severity: 99, message: 'x' }])[0]?.severity).toBe(
      'error',
    )
  })

  it('maps the range and carries the source', () => {
    expect(
      toDiagnostics([{ range: baseRange, severity: 1, message: 'oops', source: 'ts' }]),
    ).toEqual([
      {
        line: 5,
        character: 3,
        endLine: 5,
        endCharacter: 10,
        severity: 'error',
        message: 'oops',
        source: 'ts',
      },
    ])
  })

  it('returns [] for null/undefined/empty', () => {
    expect(toDiagnostics(null)).toEqual([])
    expect(toDiagnostics(undefined)).toEqual([])
    expect(toDiagnostics([])).toEqual([])
  })
})
