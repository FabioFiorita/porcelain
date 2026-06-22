import type { DiffHunk, DiffLine } from '@main/diff'
import { describe, expect, it } from 'vitest'
import { intraLineEmphasis, lineChangeRange, splitByRanges } from './word-diff'

const del = (text: string): DiffLine => ({ kind: 'del', oldLine: 1, newLine: null, text })
const add = (text: string): DiffLine => ({ kind: 'add', oldLine: null, newLine: 1, text })
const ctx = (text: string): DiffLine => ({ kind: 'context', oldLine: 1, newLine: 1, text })

describe('lineChangeRange', () => {
  it('emphasizes only the differing middle, trimming shared prefix and suffix', () => {
    // `text-` prefix and `">` suffix are shared; only the class value differs.
    const { old, new: next } = lineChangeRange(
      'class="text-[#196575]">',
      'class="text-foreground">',
    )
    expect(old).toEqual({ start: 12, end: 21 })
    expect(next).toEqual({ start: 12, end: 22 })
    expect('class="text-[#196575]">'.slice(12, 21)).toBe('[#196575]')
    expect('class="text-foreground">'.slice(12, 22)).toBe('foreground')
  })

  it('returns null for the unchanged side of a pure insertion', () => {
    const { old, new: next } = lineChangeRange('foo', 'foobar')
    expect(old).toBeNull()
    expect(next).toEqual({ start: 3, end: 6 })
  })

  it('returns null for the unchanged side of a pure deletion', () => {
    const { old, new: next } = lineChangeRange('foobar', 'foo')
    expect(old).toEqual({ start: 3, end: 6 })
    expect(next).toBeNull()
  })

  it('marks the whole line when nothing is shared', () => {
    const { old, new: next } = lineChangeRange('abc', 'xyz')
    expect(old).toEqual({ start: 0, end: 3 })
    expect(next).toEqual({ start: 0, end: 3 })
  })

  it('does not let prefix and suffix overlap', () => {
    // `aa` -> `aaa`: prefix consumes the shared run; suffix must not double-count it.
    const { old, new: next } = lineChangeRange('aa', 'aaa')
    expect(old).toBeNull()
    expect(next).toEqual({ start: 2, end: 3 })
  })

  it('reports no change for identical lines', () => {
    expect(lineChangeRange('same', 'same')).toEqual({ old: null, new: null })
  })
})

describe('intraLineEmphasis', () => {
  const hunk = (lines: DiffLine[]): DiffHunk => ({ header: '@@ -1 +1 @@', lines })

  it('pairs each del with the add below it and keys ranges by line identity', () => {
    const d = del('const a = 1')
    const a = add('const a = 2')
    const map = intraLineEmphasis([hunk([d, a])])
    expect(map.get(d)).toEqual([{ start: 10, end: 11 }])
    expect(map.get(a)).toEqual([{ start: 10, end: 11 }])
  })

  it('zips multi-line runs by position and skips the uneven overflow', () => {
    const d0 = del('alpha')
    const d1 = del('beta')
    const a0 = add('alphax')
    const map = intraLineEmphasis([hunk([d0, d1, a0])])
    // d0/a0 paired (insertion -> only the add gets a range); d1 has no counterpart.
    expect(map.get(a0)).toEqual([{ start: 5, end: 6 }])
    expect(map.has(d0)).toBe(false)
    expect(map.has(d1)).toBe(false)
  })

  it('leaves pure additions and context lines untouched', () => {
    const a = add('brand new')
    const c = ctx('unchanged')
    const map = intraLineEmphasis([hunk([c, a])])
    expect(map.size).toBe(0)
  })

  it('skips emphasis when a pair shares no prefix or suffix', () => {
    // A blank line shifts the run so the real edit pairs with a blank and the
    // leftovers are unrelated — no sub-range mark beats a misleading whole-line one.
    const d0 = del('return value')
    const a0 = add('')
    const d1 = del('totally')
    const a1 = add('different')
    const map = intraLineEmphasis([hunk([d0, d1, a0, a1])])
    expect(map.size).toBe(0)
  })

  it('still emphasizes when only the indentation is shared', () => {
    const d = del('  return a')
    const a = add('  return b')
    const map = intraLineEmphasis([hunk([d, a])])
    expect(map.get(d)).toEqual([{ start: 9, end: 10 }])
    expect(map.get(a)).toEqual([{ start: 9, end: 10 }])
  })
})

describe('splitByRanges', () => {
  it('splits a single plain span at range boundaries, flagging the middle', () => {
    expect(splitByRanges([{ content: 'text-foreground' }], [{ start: 5, end: 15 }])).toEqual([
      { content: 'text-', color: undefined, emphasized: false },
      { content: 'foreground', color: undefined, emphasized: true },
    ])
  })

  it('cuts across token boundaries while preserving colors', () => {
    const tokens = [
      { content: 'ab', color: '#1' },
      { content: 'cd', color: '#2' },
    ]
    expect(splitByRanges(tokens, [{ start: 1, end: 3 }])).toEqual([
      { content: 'a', color: '#1', emphasized: false },
      { content: 'b', color: '#1', emphasized: true },
      { content: 'c', color: '#2', emphasized: true },
      { content: 'd', color: '#2', emphasized: false },
    ])
  })

  it('flags nothing when there are no ranges', () => {
    expect(splitByRanges([{ content: 'abc', color: '#1' }], [])).toEqual([
      { content: 'abc', color: '#1', emphasized: false },
    ])
  })
})
