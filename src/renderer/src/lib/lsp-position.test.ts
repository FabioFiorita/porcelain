import { describe, expect, it } from 'vitest'
import { isLspLang, offsetToPosition, positionToOffset } from './lsp-position'

describe('offsetToPosition', () => {
  it('maps offset 0 to the document start', () => {
    expect(offsetToPosition('abc\ndef', 0)).toEqual({ line: 0, character: 0 })
  })

  it('maps an offset within the first line', () => {
    expect(offsetToPosition('abc\ndef', 2)).toEqual({ line: 0, character: 2 })
  })

  it('counts the newline so the next char starts line 1', () => {
    expect(offsetToPosition('abc\ndef', 4)).toEqual({ line: 1, character: 0 })
  })

  it('maps an offset on a later line', () => {
    expect(offsetToPosition('abc\ndef', 6)).toEqual({ line: 1, character: 2 })
  })

  it('maps the very end of the file', () => {
    expect(offsetToPosition('abc\ndef', 7)).toEqual({ line: 1, character: 3 })
  })

  it('handles empty content', () => {
    expect(offsetToPosition('', 0)).toEqual({ line: 0, character: 0 })
  })

  it('clamps a negative offset to the start', () => {
    expect(offsetToPosition('abc', -5)).toEqual({ line: 0, character: 0 })
  })

  it('clamps an over-long offset to the end', () => {
    expect(offsetToPosition('abc\ndef', 999)).toEqual({ line: 1, character: 3 })
  })

  it('treats a blank line as its own line', () => {
    // "a\n\nb" — offset 2 sits at the empty middle line
    expect(offsetToPosition('a\n\nb', 2)).toEqual({ line: 1, character: 0 })
    expect(offsetToPosition('a\n\nb', 3)).toEqual({ line: 2, character: 0 })
  })
})

describe('positionToOffset', () => {
  it('maps the document start', () => {
    expect(positionToOffset('abc\ndef', { line: 0, character: 0 })).toBe(0)
  })

  it('maps a position within the first line', () => {
    expect(positionToOffset('abc\ndef', { line: 0, character: 2 })).toBe(2)
  })

  it('maps the start of a later line past the newline', () => {
    expect(positionToOffset('abc\ndef', { line: 1, character: 0 })).toBe(4)
  })

  it('maps a position on a later line', () => {
    expect(positionToOffset('abc\ndef', { line: 1, character: 2 })).toBe(6)
  })

  it('clamps a character past the line end to the line end', () => {
    // line 0 is "abc" (len 3); character 99 must not bleed onto line 1
    expect(positionToOffset('abc\ndef', { line: 0, character: 99 })).toBe(3)
  })

  it('clamps a line past EOF to the document end', () => {
    expect(positionToOffset('abc\ndef', { line: 99, character: 0 })).toBe(7)
  })

  it('clamps a negative line to the start', () => {
    expect(positionToOffset('abc', { line: -1, character: 2 })).toBe(2)
  })

  it('round-trips with offsetToPosition', () => {
    const content = 'const x = 1\nlet y = 2\n\nreturn x + y'
    for (let offset = 0; offset <= content.length; offset++) {
      expect(positionToOffset(content, offsetToPosition(content, offset))).toBe(offset)
    }
  })
})

describe('isLspLang', () => {
  it.each([
    'a.ts',
    'a.tsx',
    'a.mts',
    'a.cts',
    'a.js',
    'a.jsx',
    'a.mjs',
    'a.cjs',
  ])('accepts %s', (path) => {
    expect(isLspLang(path)).toBe(true)
  })

  it.each([
    'a.json',
    'a.css',
    'a.md',
    'README',
    'a.py',
    'a.swift',
    'a.txt',
  ])('rejects %s', (path) => {
    expect(isLspLang(path)).toBe(false)
  })

  it('is case-insensitive on the extension', () => {
    expect(isLspLang('Component.TSX')).toBe(true)
  })

  it('handles a path with dots in directories', () => {
    expect(isLspLang('/a.b/c.d/index.ts')).toBe(true)
    expect(isLspLang('/a.ts/c.d/index.md')).toBe(false)
  })
})
