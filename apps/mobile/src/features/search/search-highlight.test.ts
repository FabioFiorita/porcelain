import type { CodeSearchLine } from '@porcelain/contracts/search'
import { describe, expect, it } from 'vitest'

import { commonIndent, matchSpans } from './search-highlight'

function line(text: string, match = true): CodeSearchLine {
  return { line: 1, match, text }
}

describe('matchSpans', () => {
  it('finds every occurrence of a literal query', () => {
    expect(matchSpans('const repo = repoPath', 'repo', false, false)).toEqual([
      { end: 10, start: 6 },
      { end: 17, start: 13 },
    ])
  })

  it('ignores case unless the reader asked for it', () => {
    expect(matchSpans('RepoPath', 'repo', false, false)).toEqual([{ end: 4, start: 0 }])
    expect(matchSpans('RepoPath', 'repo', false, true)).toEqual([])
  })

  it('highlights nothing for a regex query', () => {
    // git greps with POSIX -E; JS regex semantics differ, so a highlight here would point at
    // the wrong characters with total confidence.
    expect(matchSpans('const repo = 1', 're(po|ad)', true, false)).toEqual([])
  })

  it('does not loop on an empty query', () => {
    expect(matchSpans('anything', '', false, false)).toEqual([])
  })

  it('does not overlap spans for a self-repeating query', () => {
    expect(matchSpans('aaaa', 'aa', false, true)).toEqual([
      { end: 2, start: 0 },
      { end: 4, start: 2 },
    ])
  })
})

describe('commonIndent', () => {
  it('strips the indentation the whole hunk shares', () => {
    expect(commonIndent([line('    if (x) {'), line('      return 1'), line('    }')])).toBe(4)
  })

  it('ignores blank lines, which have no indentation to speak of', () => {
    expect(commonIndent([line('    a'), line(''), line('    b')])).toBe(4)
  })

  it('is zero when every line is blank', () => {
    expect(commonIndent([line(''), line('   ')])).toBe(0)
  })
})
