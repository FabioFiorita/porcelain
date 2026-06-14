import { describe, expect, it } from 'vitest'
import { getHighlighter, languageFor, tokenizeLines } from './highlight'

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
