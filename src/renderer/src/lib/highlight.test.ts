import { describe, expect, it } from 'vitest'
import {
  getHighlighter,
  isTokenizable,
  languageFor,
  MAX_TOKENIZE_LINES,
  tokenizeLines,
} from './highlight'

describe('languageFor', () => {
  it('maps known extensions to shiki languages', () => {
    expect(languageFor('src/api.ts')).toBe('typescript')
    expect(languageFor('App.tsx')).toBe('tsx')
    expect(languageFor('notes.md')).toBe('markdown')
  })

  it('returns null for unknown extensions', () => {
    expect(languageFor('binary.bin')).toBeNull()
    expect(languageFor('no-extension')).toBeNull()
  })
})

describe('tokenizeLines', () => {
  it('returns one token array per line', async () => {
    const h = await getHighlighter()
    const tokens = tokenizeLines(h, 'const a = 1\nconst b = 2', 'typescript')
    expect(tokens).toHaveLength(2)
  })

  it('keeps multiline-comment continuation lines colored as comments', async () => {
    const h = await getHighlighter()
    const code = [
      '/**',
      ' * Map a backend CalloutView into the lib CallOut.',
      ' */',
      'const x = 1',
    ].join('\n')
    const tokens = tokenizeLines(h, code, 'typescript')

    // The interior line (index 1) is inside the block comment. Per-line
    // tokenization used to lose that state and color `Map`/`CalloutView` as
    // code; whole-file tokenization keeps the whole line one comment color.
    const interiorColors = new Set(tokens[1]?.map((t) => t.color))
    expect(interiorColors.size).toBe(1)

    // …and that color is the comment color, not a code color (variable blue).
    const commentColor = tokens[0]?.[0]?.color
    expect([...interiorColors][0]).toBe(commentColor)
  })
})

describe('isTokenizable', () => {
  it('allows normal-sized files', () => {
    expect(isTokenizable('a\n'.repeat(100))).toBe(true)
    expect(isTokenizable('')).toBe(true)
  })

  it('blocks files past the line cap', () => {
    expect(isTokenizable('a\n'.repeat(MAX_TOKENIZE_LINES + 1))).toBe(false)
  })

  it('allows files right at the line cap', () => {
    // Exactly MAX_TOKENIZE_LINES newlines is still tokenizable.
    expect(isTokenizable('a\n'.repeat(MAX_TOKENIZE_LINES))).toBe(true)
  })

  it('blocks files past the 2 MB byte cap regardless of line count', () => {
    // One enormous line (no newlines) — slips under a pure line-count check.
    const huge = 'x'.repeat(2 * 1024 * 1024 + 1)
    expect(isTokenizable(huge)).toBe(false)
  })

  it('allows files just under the byte cap', () => {
    const fine = 'x'.repeat(2 * 1024 * 1024 - 1)
    expect(isTokenizable(fine)).toBe(true)
  })
})
