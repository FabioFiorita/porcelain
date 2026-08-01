import { describe, expect, it } from 'vitest'

import { wordDiff } from './word-diff'

describe('wordDiff', () => {
  it('marks only the word that changed, on both sides', () => {
    expect(wordDiff('const a = 1', 'const b = 1')).toEqual({
      add: [{ end: 7, start: 6 }],
      del: [{ end: 7, start: 6 }],
    })
  })

  it('finds a change inside a call', () => {
    expect(wordDiff('foo(bar)', 'foo(baz)')).toEqual({
      add: [{ end: 7, start: 4 }],
      del: [{ end: 7, start: 4 }],
    })
  })

  it('reports nothing for identical or empty lines', () => {
    expect(wordDiff('same', 'same')).toEqual({ add: [], del: [] })
    expect(wordDiff('', 'anything')).toEqual({ add: [], del: [] })
  })

  it('ignores re-indentation', () => {
    expect(wordDiff('  value', '    value')).toEqual({ add: [], del: [] })
  })

  it('suppresses a rewrite that would highlight most of the line', () => {
    expect(wordDiff('alpha beta', 'gamma delta')).toEqual({ add: [], del: [] })
  })

  it('suppresses more than four fragments even when each is small', () => {
    const before = 'const a=1; const b=2; const c=3; const d=4; const e=5; const f=6;'
    const after = 'const a=7; const b=8; const c=9; const d=0; const e=4; const f=3;'
    expect(wordDiff(before, after)).toEqual({ add: [], del: [] })
  })
})
