import { describe, expect, it } from 'vitest'
import { parseStatus, parseUnifiedDiff, synthesizeAddDiff } from './diff'

describe('parseStatus', () => {
  it('parses porcelain -z output into changed files', () => {
    const out = ' M src/a.ts\0?? src/new.ts\0D  src/gone.ts\0'
    expect(parseStatus(out)).toEqual([
      { path: 'src/a.ts', status: 'modified' },
      { path: 'src/new.ts', status: 'untracked' },
      { path: 'src/gone.ts', status: 'deleted' },
    ])
  })

  it('returns empty for empty output', () => {
    expect(parseStatus('')).toEqual([])
  })
})

describe('parseUnifiedDiff', () => {
  it('parses hunks with line numbers', () => {
    const diff = [
      'diff --git a/f b/f',
      '--- a/f',
      '+++ b/f',
      '@@ -1,3 +1,3 @@',
      ' unchanged',
      '-old line',
      '+new line',
      ' tail',
    ].join('\n')

    const hunks = parseUnifiedDiff(diff)
    expect(hunks).toHaveLength(1)
    expect(hunks[0]?.lines).toEqual([
      { kind: 'context', oldLine: 1, newLine: 1, text: 'unchanged' },
      { kind: 'del', oldLine: 2, newLine: null, text: 'old line' },
      { kind: 'add', oldLine: null, newLine: 2, text: 'new line' },
      { kind: 'context', oldLine: 3, newLine: 3, text: 'tail' },
    ])
  })

  it('handles multiple hunks', () => {
    const diff = ['@@ -1 +1 @@', '-a', '+b', '@@ -10,2 +10,2 @@', ' x', '-y', '+z'].join('\n')
    const hunks = parseUnifiedDiff(diff)
    expect(hunks).toHaveLength(2)
    expect(hunks[1]?.lines[1]).toEqual({ kind: 'del', oldLine: 11, newLine: null, text: 'y' })
  })
})

describe('synthesizeAddDiff', () => {
  it('turns file content into an all-add hunk', () => {
    const hunks = synthesizeAddDiff('one\ntwo\n')
    expect(hunks[0]?.lines).toEqual([
      { kind: 'add', oldLine: null, newLine: 1, text: 'one' },
      { kind: 'add', oldLine: null, newLine: 2, text: 'two' },
    ])
  })

  it('returns no hunks for empty content', () => {
    expect(synthesizeAddDiff('')).toEqual([])
  })
})
