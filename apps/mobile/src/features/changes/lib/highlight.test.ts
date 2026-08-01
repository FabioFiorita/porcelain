import { describe, expect, it } from 'vitest'

import type { ShikiHighlighter, ShikiToken } from './highlight'
import { buildTokensPatch, languageForPath, shikiRowTokenizer } from './highlight'

const highlighter: ShikiHighlighter = {
  codeToTokensBase: (code: string): ShikiToken[][] => [
    [{ color: '#FF0000', content: code.slice(0, 3), fontStyle: 3 }, { content: code.slice(3) }],
  ],
  getLoadedLanguages: (): string[] => ['typescript'],
}

describe('languageForPath', () => {
  it('resolves an extension, and admits when it cannot', () => {
    expect(languageForPath('src/a.tsx')).toBe('tsx')
    expect(languageForPath('scripts/run.MJS')).toBe('javascript')
    expect(languageForPath('LICENSE')).toBeUndefined()
    expect(languageForPath('data.bin')).toBeUndefined()
  })
})

describe('shikiRowTokenizer', () => {
  it('carries colour and font style across', () => {
    const tokenizer = shikiRowTokenizer(highlighter, 'porcelain')
    expect(tokenizer.tokenize({ path: 'a.ts', text: 'const x' })).toEqual([
      { bold: true, color: '#FF0000', italic: true, text: 'con' },
      { bold: false, color: undefined, italic: false, text: 'st x' },
    ])
  })

  it('declines a language the highlighter never loaded', () => {
    const tokenizer = shikiRowTokenizer(highlighter, 'porcelain')
    expect(tokenizer.tokenize({ path: 'a.py', text: 'x = 1' })).toEqual([])
    expect(tokenizer.tokenize({ path: 'LICENSE', text: 'MIT' })).toEqual([])
  })
})

describe('buildTokensPatch', () => {
  it('reports every row as covered but stores only the coloured ones', () => {
    const { covered, patch } = buildTokensPatch(
      ['a', 'b', 'missing'],
      new Map([
        ['a', { path: 'a.ts', text: 'const x' }],
        ['b', { path: 'b.py', text: 'x = 1' }],
      ]),
      shikiRowTokenizer(highlighter, 'porcelain'),
      'reset-1',
    )

    expect(covered).toEqual(['a', 'b', 'missing'])
    expect(Object.keys(patch.tokensByRowId)).toEqual(['a'])
    expect(patch.resetKey).toBe('reset-1')
  })
})
