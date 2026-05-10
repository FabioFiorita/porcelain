import { describe, expect, it } from 'vitest'
import {
  parseLog,
  parseNameStatus,
  parseNumstat,
  parseStatus,
  parseUnifiedDiff,
  parseWorktrees,
  synthesizeAddDiff,
} from './diff'

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

describe('parseLog', () => {
  it('parses log records', () => {
    const out =
      'abc\x1fAlice\x1f2 days ago\x1ffeat: thing\x1e\ndef\x1fBob\x1f3 days ago\x1ffix: other\x1e'
    expect(parseLog(out)).toEqual([
      { hash: 'abc', author: 'Alice', date: '2 days ago', subject: 'feat: thing' },
      { hash: 'def', author: 'Bob', date: '3 days ago', subject: 'fix: other' },
    ])
  })
})

describe('parseNameStatus', () => {
  it('parses statuses including renames', () => {
    const out = 'M\0a.ts\0A\0b.ts\0R100\0old.ts\0new.ts\0'
    expect(parseNameStatus(out)).toEqual([
      { path: 'a.ts', status: 'modified' },
      { path: 'b.ts', status: 'added' },
      { path: 'new.ts', status: 'renamed' },
    ])
  })
})

describe('parseWorktrees', () => {
  it('parses worktree blocks with branches and detached heads', () => {
    const out =
      'worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo-wt/fix\nHEAD def\nbranch refs/heads/fix-1\n\nworktree /repo-wt/detached\nHEAD eee\ndetached\n'
    expect(parseWorktrees(out)).toEqual([
      { path: '/repo', branch: 'main' },
      { path: '/repo-wt/fix', branch: 'fix-1' },
      { path: '/repo-wt/detached', branch: '(detached)' },
    ])
  })
})

describe('parseNumstat', () => {
  it('parses additions and deletions, zeroing binary markers', () => {
    const out = '12\t3\tsrc/a.ts\0-\t-\timg.png\0'
    expect(parseNumstat(out)).toEqual([
      { path: 'src/a.ts', additions: 12, deletions: 3 },
      { path: 'img.png', additions: 0, deletions: 0 },
    ])
  })
})
