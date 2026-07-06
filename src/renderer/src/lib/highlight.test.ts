import { describe, expect, it } from 'vitest'
import {
  getHighlighter,
  isTokenizable,
  LANGS,
  languageFor,
  MAX_TOKENIZE_LINES,
  tokenizeLines,
} from './highlight'

describe('languageFor', () => {
  it('maps known extensions to shiki languages', () => {
    expect(languageFor('src/api.ts')).toBe('typescript')
    expect(languageFor('App.tsx')).toBe('tsx')
    expect(languageFor('notes.md')).toBe('markdown')
    expect(languageFor('ContentView.swift')).toBe('swift')
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

  it('tokenizes every one of the fine-grained bundled languages', async () => {
    const h = await getHighlighter()
    // Proves all 11 grammars registered by the core highlighter loaded — a
    // missing @shikijs/langs import would throw here, not just ship a bad theme.
    for (const lang of LANGS) {
      expect(Array.isArray(tokenizeLines(h, 'x', lang))).toBe(true)
    }
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

describe('tokenizeLines cache', () => {
  // Uses the real highlighter: `codeToTokensBase` allocates a fresh array on
  // every call, so an identical array reference across two calls can ONLY come
  // from the module-level LRU. Unique keys per test keep the shared cache from
  // cross-contaminating; the eviction/recency cases fully replace an 8-cap
  // cache (8+ distinct inserts), so they hold regardless of prior state.
  it('returns the same array reference for a repeated (code, lang)', async () => {
    const h = await getHighlighter()
    const a = tokenizeLines(h, 'z-cache-repeat', 'typescript')
    const b = tokenizeLines(h, 'z-cache-repeat', 'typescript')
    expect(b).toBe(a)
  })

  it('keys on lang: same code, different lang → different result', async () => {
    const h = await getHighlighter()
    const ts = tokenizeLines(h, 'z-cache-lang', 'typescript')
    const js = tokenizeLines(h, 'z-cache-lang', 'javascript')
    expect(js).not.toBe(ts)
  })

  it('evicts the least-recently-used entry past the cap', async () => {
    const h = await getHighlighter()
    const first = tokenizeLines(h, 'z-evict-0', 'typescript')
    // 8 more distinct entries → 9 distinct inserts into an 8-cap LRU, so the
    // never-touched first entry is the least-recently-used and gets evicted.
    for (let i = 1; i <= 8; i++) tokenizeLines(h, `z-evict-${i}`, 'typescript')
    // Re-request the first: evicted, so a fresh (non-identical) array.
    expect(tokenizeLines(h, 'z-evict-0', 'typescript')).not.toBe(first)
  })

  it('keeps a touched entry and evicts the next-oldest instead', async () => {
    const h = await getHighlighter()
    // 8 distinct inserts fully replace the 8-cap cache: order is 0,1,…,7.
    const kept = tokenizeLines(h, 'z-recency-0', 'typescript')
    const second = tokenizeLines(h, 'z-recency-1', 'typescript')
    for (let i = 2; i < 8; i++) tokenizeLines(h, `z-recency-${i}`, 'typescript')
    // Touch the oldest (0), making it most-recently-used → order 1,…,7,0.
    expect(tokenizeLines(h, 'z-recency-0', 'typescript')).toBe(kept)
    // One more insert overflows the cap: the now-oldest (1) is evicted, not 0.
    tokenizeLines(h, 'z-recency-overflow', 'typescript')
    expect(tokenizeLines(h, 'z-recency-0', 'typescript')).toBe(kept)
    expect(tokenizeLines(h, 'z-recency-1', 'typescript')).not.toBe(second)
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
