import { describe, expect, it } from 'vitest'
import {
  parseCodeSearch,
  parseGrep,
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
      { path: 'src/a.ts', status: 'modified', staged: false, unstaged: true },
      { path: 'src/new.ts', status: 'untracked', staged: false, unstaged: true },
      { path: 'src/gone.ts', status: 'deleted', staged: true, unstaged: false },
    ])
  })

  it('derives staged/unstaged from the XY columns', () => {
    // X = index (staged), Y = working tree (unstaged); `MM` is both.
    const out = 'M  staged.ts\0 M unstaged.ts\0MM both.ts\0A  new-staged.ts\0'
    expect(parseStatus(out)).toEqual([
      { path: 'staged.ts', status: 'modified', staged: true, unstaged: false },
      { path: 'unstaged.ts', status: 'modified', staged: false, unstaged: true },
      { path: 'both.ts', status: 'modified', staged: true, unstaged: true },
      { path: 'new-staged.ts', status: 'added', staged: true, unstaged: false },
    ])
  })

  it('returns empty for empty output', () => {
    expect(parseStatus('')).toEqual([])
  })

  it('treats a staged rename as one row (new path) without a phantom old-path row', () => {
    // `git status --porcelain=v1 -z` emits a staged rename as `R  <new>\0<old>\0`.
    const out = 'R  renamed.ts\0original.ts\0 M other.ts\0'
    expect(parseStatus(out)).toEqual([
      { path: 'renamed.ts', status: 'renamed', staged: true, unstaged: false },
      { path: 'other.ts', status: 'modified', staged: false, unstaged: true },
    ])
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

  it('attributes rename-with-edit counts to the new path', () => {
    // `git diff --numstat -z` emits a renamed-with-edits file as
    // `adds\tdels\t\0<old>\0<new>\0` (empty path on the stat line).
    const out = '2\t1\t\0old.ts\0new.ts\0'
    expect(parseNumstat(out)).toEqual([{ path: 'new.ts', additions: 2, deletions: 1 }])
  })
})

describe('parseGrep', () => {
  it('parses path:line:text rows', () => {
    const out = 'src/a.ts:3:const x = getUser()\nsrc/b/c.tsx:12:  getUser()\n'
    expect(parseGrep(out)).toEqual([
      { path: 'src/a.ts', line: 3, text: 'const x = getUser()' },
      { path: 'src/b/c.tsx', line: 12, text: '  getUser()' },
    ])
  })

  it('keeps colons inside the matched text', () => {
    expect(parseGrep('a.ts:1:const url = "http://x"')).toEqual([
      { path: 'a.ts', line: 1, text: 'const url = "http://x"' },
    ])
  })

  it('skips malformed rows', () => {
    expect(parseGrep('garbage\nno-line:abc:text\n')).toEqual([])
  })
})

describe('parseCodeSearch', () => {
  it('groups --heading/--break/-C output into per-file context hunks', () => {
    const out = [
      'src/a.ts',
      "2-import { db } from './db'",
      '3:export function getUser(id) {',
      '4-  return db.users.find(id)',
      '--',
      '10-function other() {',
      '11:  getUser(1)',
      '12-}',
      '',
      'src/b.ts',
      '5:const u = getUser(2)',
      '',
    ].join('\n')

    expect(parseCodeSearch(out)).toEqual([
      {
        path: 'src/a.ts',
        matchCount: 2,
        hunks: [
          {
            lines: [
              { line: 2, text: "import { db } from './db'", match: false },
              { line: 3, text: 'export function getUser(id) {', match: true },
              { line: 4, text: '  return db.users.find(id)', match: false },
            ],
          },
          {
            lines: [
              { line: 10, text: 'function other() {', match: false },
              { line: 11, text: '  getUser(1)', match: true },
              { line: 12, text: '}', match: false },
            ],
          },
        ],
      },
      {
        path: 'src/b.ts',
        matchCount: 1,
        hunks: [{ lines: [{ line: 5, text: 'const u = getUser(2)', match: true }] }],
      },
    ])
  })

  it('keeps colons inside the matched text', () => {
    const out = 'a.ts\n1:const url = "http://x"\n'
    expect(parseCodeSearch(out)).toEqual([
      {
        path: 'a.ts',
        matchCount: 1,
        hunks: [{ lines: [{ line: 1, text: 'const url = "http://x"', match: true }] }],
      },
    ])
  })

  it('returns nothing for empty output', () => {
    expect(parseCodeSearch('')).toEqual([])
  })
})
