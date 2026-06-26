import { describe, expect, it } from 'vitest'
import {
  applyTextEdits,
  createMessageBuffer,
  encodeMessage,
  toCompletionItems,
  toDiagnostics,
  toHoverInfo,
  toRenamePrep,
  toSymbolLocations,
  toTextEdits,
  toWorkspaceEdit,
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

describe('toCompletionItems', () => {
  it('normalizes a bare CompletionItem[] array', () => {
    const out = toCompletionItems([{ label: 'foo' }, { label: 'bar' }])
    expect(out.map((c) => c.label)).toEqual(['foo', 'bar'])
  })

  it('normalizes a { isIncomplete, items } completion list', () => {
    const out = toCompletionItems({ isIncomplete: true, items: [{ label: 'baz' }] })
    expect(out.map((c) => c.label)).toEqual(['baz'])
  })

  it('maps kind codes 1..25 to labels, defaulting absent/unknown to text', () => {
    const out = toCompletionItems([
      { label: 'a', kind: 1 },
      { label: 'b', kind: 3 },
      { label: 'c', kind: 7 },
      { label: 'd', kind: 25 },
      { label: 'e' }, // absent kind
      { label: 'f', kind: 99 }, // unknown code
    ])
    expect(out.map((c) => c.kind)).toEqual([
      'text',
      'function',
      'class',
      'typeparameter',
      'text',
      'text',
    ])
  })

  it('carries detail/insertText/sortText/filterText and flattens documentation', () => {
    const out = toCompletionItems([
      {
        label: 'doStuff',
        detail: '(): void',
        documentation: { kind: 'markdown', value: 'does stuff' },
        insertText: 'doStuff()',
        sortText: '0001',
        filterText: 'doStuff',
      },
      { label: 'plain', documentation: 'a plain doc string' },
    ])
    expect(out[0]).toMatchObject({
      label: 'doStuff',
      detail: '(): void',
      documentation: 'does stuff',
      insertText: 'doStuff()',
      sortText: '0001',
      filterText: 'doStuff',
    })
    expect(out[1]?.documentation).toBe('a plain doc string')
  })

  it('extracts the replace range from a plain TextEdit', () => {
    const out = toCompletionItems([
      {
        label: 'x',
        textEdit: {
          range: { start: { line: 2, character: 4 }, end: { line: 2, character: 9 } },
          newText: 'xLonger',
        },
      },
    ])
    expect(out[0]?.replace).toEqual({ line: 2, character: 4, endLine: 2, endCharacter: 9 })
    expect(out[0]?.newText).toBe('xLonger')
  })

  it('prefers the replace range from an InsertReplaceEdit (overtype)', () => {
    const out = toCompletionItems([
      {
        label: 'y',
        textEdit: {
          insert: { start: { line: 1, character: 0 }, end: { line: 1, character: 2 } },
          replace: { start: { line: 1, character: 0 }, end: { line: 1, character: 6 } },
          newText: 'yReplaced',
        },
      },
    ])
    expect(out[0]?.replace).toEqual({ line: 1, character: 0, endLine: 1, endCharacter: 6 })
    expect(out[0]?.newText).toBe('yReplaced')
  })

  it('leaves replace/newText undefined when there is no textEdit', () => {
    const out = toCompletionItems([{ label: 'z' }])
    expect(out[0]?.replace).toBeUndefined()
    expect(out[0]?.newText).toBeUndefined()
  })

  it('drops label-less items', () => {
    const out = toCompletionItems([{ kind: 3 }, { label: 'kept' }])
    expect(out.map((c) => c.label)).toEqual(['kept'])
  })

  it('returns [] for null/undefined and a list with no items', () => {
    expect(toCompletionItems(null)).toEqual([])
    expect(toCompletionItems(undefined)).toEqual([])
    expect(toCompletionItems({ items: [] })).toEqual([])
  })
})

describe('toTextEdits', () => {
  it('maps each edit range to the flat shape and carries newText', () => {
    const out = toTextEdits([
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
        newText: 'let',
      },
      {
        range: { start: { line: 4, character: 2 }, end: { line: 5, character: 0 } },
        newText: '',
      },
    ])
    expect(out).toEqual([
      { line: 0, character: 0, endLine: 0, endCharacter: 3, newText: 'let' },
      { line: 4, character: 2, endLine: 5, endCharacter: 0, newText: '' },
    ])
  })

  it('returns [] for null/undefined/empty', () => {
    expect(toTextEdits(null)).toEqual([])
    expect(toTextEdits(undefined)).toEqual([])
    expect(toTextEdits([])).toEqual([])
  })
})

describe('toRenamePrep', () => {
  const range = { start: { line: 3, character: 6 }, end: { line: 3, character: 12 } }

  it('returns null for null/undefined', () => {
    expect(toRenamePrep(null)).toBeNull()
    expect(toRenamePrep(undefined)).toBeNull()
  })

  it('maps a bare Range with an empty placeholder', () => {
    expect(toRenamePrep(range)).toEqual({
      line: 3,
      character: 6,
      endLine: 3,
      endCharacter: 12,
      placeholder: '',
    })
  })

  it('maps a { range, placeholder } carrying the placeholder through', () => {
    expect(toRenamePrep({ range, placeholder: 'oldName' })).toEqual({
      line: 3,
      character: 6,
      endLine: 3,
      endCharacter: 12,
      placeholder: 'oldName',
    })
  })

  it('returns null for { defaultBehavior: true } (no range) and false (not renamable)', () => {
    expect(toRenamePrep({ defaultBehavior: true })).toBeNull()
    expect(toRenamePrep({ defaultBehavior: false })).toBeNull()
  })
})

describe('toWorkspaceEdit', () => {
  const edit = (newText: string) => ({
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    newText,
  })

  it('normalizes the `changes` (uri→edits) shape, decoding file:// uris', () => {
    const out = toWorkspaceEdit({
      changes: {
        'file:///a.ts': [edit('A')],
        'file:///b.ts': [edit('B')],
      },
    })
    expect(out).toEqual([
      {
        path: '/a.ts',
        edits: [{ line: 0, character: 0, endLine: 0, endCharacter: 1, newText: 'A' }],
      },
      {
        path: '/b.ts',
        edits: [{ line: 0, character: 0, endLine: 0, endCharacter: 1, newText: 'B' }],
      },
    ])
  })

  it('normalizes the `documentChanges` (versioned) shape', () => {
    const out = toWorkspaceEdit({
      documentChanges: [{ textDocument: { uri: 'file:///c.ts' }, edits: [edit('C')] }],
    })
    expect(out).toEqual([
      {
        path: '/c.ts',
        edits: [{ line: 0, character: 0, endLine: 0, endCharacter: 1, newText: 'C' }],
      },
    ])
  })

  it('drops non-file uris from both shapes', () => {
    expect(
      toWorkspaceEdit({ changes: { 'untitled:foo': [edit('x')], 'file:///keep.ts': [edit('k')] } }),
    ).toEqual([
      {
        path: '/keep.ts',
        edits: [{ line: 0, character: 0, endLine: 0, endCharacter: 1, newText: 'k' }],
      },
    ])
    expect(
      toWorkspaceEdit({
        documentChanges: [{ textDocument: { uri: 'untitled:foo' }, edits: [edit('x')] }],
      }),
    ).toEqual([])
  })

  it('skips resource ops (documentChanges entries without edits)', () => {
    expect(
      toWorkspaceEdit({
        documentChanges: [{ textDocument: { uri: 'file:///renamed.ts' } }],
      }),
    ).toEqual([])
  })

  it('returns [] for null/undefined', () => {
    expect(toWorkspaceEdit(null)).toEqual([])
    expect(toWorkspaceEdit(undefined)).toEqual([])
  })
})

describe('applyTextEdits', () => {
  it('applies an early and a late edit together, both landing correctly', () => {
    // Three lines; replace "foo" on line 0 and "baz" on line 2 in one pass. The
    // descending-by-offset splice means the early edit must not shift the late one.
    const content = 'foo = 1\nbar = 2\nbaz = 3'
    const out = applyTextEdits(content, [
      { line: 0, character: 0, endLine: 0, endCharacter: 3, newText: 'FOO' },
      { line: 2, character: 0, endLine: 2, endCharacter: 3, newText: 'BAZ' },
    ])
    expect(out).toBe('FOO = 1\nbar = 2\nBAZ = 3')
  })

  it('lands both edits regardless of input order (sort, not array order)', () => {
    const content = 'foo = 1\nbar = 2\nbaz = 3'
    const out = applyTextEdits(content, [
      { line: 2, character: 0, endLine: 2, endCharacter: 3, newText: 'BAZ' },
      { line: 0, character: 0, endLine: 0, endCharacter: 3, newText: 'FOO' },
    ])
    expect(out).toBe('FOO = 1\nbar = 2\nBAZ = 3')
  })

  it('applies a single whole-document replace', () => {
    const content = 'old\ncontent\nhere'
    const out = applyTextEdits(content, [
      { line: 0, character: 0, endLine: 2, endCharacter: 4, newText: 'brand new\nbody' },
    ])
    expect(out).toBe('brand new\nbody')
  })

  it('returns content unchanged for an empty edit list', () => {
    expect(applyTextEdits('unchanged', [])).toBe('unchanged')
  })
})
