import { describe, expect, it } from 'vitest'

import type { ShikiHighlighter, ShikiToken } from './highlight'
import {
  buildSourceTokensPatch,
  buildTokensPatch,
  isSourceTokenizable,
  languageForPath,
  shikiRowTokenizer,
  tokenizeSourceDocument,
} from './highlight'

const highlighter: ShikiHighlighter = {
  codeToTokensBase: (code: string): ShikiToken[][] =>
    code
      .split('\n')
      .map((line) => [
        { color: '#FF0000', content: line.slice(0, 3), fontStyle: 3 },
        { content: line.slice(3) },
      ]),
  getLoadedLanguages: (): string[] => ['typescript', 'shellscript'],
}

describe('languageForPath', () => {
  it('resolves an extension, and admits when it cannot', () => {
    expect(languageForPath('src/a.tsx')).toBe('tsx')
    expect(languageForPath('scripts/run.MJS')).toBe('javascript')
    expect(languageForPath('scripts/run.sh')).toBe('shellscript')
    expect(languageForPath('.env.local')).toBe('dotenv')
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

describe('tokenizeSourceDocument', () => {
  it('tokenises the whole file so line ids match the source canvas', () => {
    const tokens = tokenizeSourceDocument(highlighter, 'const x\nlet y', 'a.ts', 'dark-plus')
    expect(tokens?.get('L1')?.[0]).toMatchObject({ bold: true, color: '#FF0000', text: 'con' })
    expect(tokens?.get('L2')?.[0]).toMatchObject({ text: 'let' })
  })

  it('declines an unknown or unloaded language', () => {
    expect(tokenizeSourceDocument(highlighter, 'x = 1', 'a.py', 'dark-plus')).toBeNull()
    expect(tokenizeSourceDocument(highlighter, 'x', 'LICENSE', 'dark-plus')).toBeNull()
  })
})

describe('buildSourceTokensPatch', () => {
  it('covers the window and only emits rows that have tokens', () => {
    const tokens = new Map([
      ['L1', [{ color: '#fff', text: 'a' }]],
      ['L2', [{ text: 'b' }]],
    ])
    const { covered, patch } = buildSourceTokensPatch(['L1', 'L3'], tokens, 'reset')
    expect(covered).toEqual(['L1', 'L3'])
    expect(Object.keys(patch.tokensByRowId)).toEqual(['L1'])
  })
})

describe('isSourceTokenizable', () => {
  it('accepts ordinary source and rejects pathological sizes', () => {
    expect(isSourceTokenizable('const x = 1\n')).toBe(true)
    expect(isSourceTokenizable(`${'x'.repeat(2 * 1024 * 1024 + 1)}`)).toBe(false)
  })
})
