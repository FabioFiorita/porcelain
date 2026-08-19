import type { DiffHunk, DiffLine } from '@porcelain/contracts/git'
import { describe, expect, it } from 'vitest'
import {
  addRange,
  allRevealed,
  collapseHunks,
  DEFAULT_DIFF_CONTEXT,
  revealDown,
  revealUp,
  revealWhole,
} from './collapse-hunks'

/** A whole-file diff: `total` lines, with the lines in `changed` replaced. */
function wholeFileHunk(total: number, changed: readonly number[]): DiffHunk {
  const lines: DiffLine[] = []
  for (let n = 1; n <= total; n++) {
    if (changed.includes(n)) {
      lines.push({ kind: 'del', newLine: null, oldLine: n, text: `old ${n}` })
      lines.push({ kind: 'add', newLine: n, oldLine: null, text: `new ${n}` })
    } else {
      lines.push({ kind: 'context', newLine: n, oldLine: n, text: `line ${n}` })
    }
  }
  return { header: `@@ -1,${total} +1,${total} @@`, lines }
}

function visibleNewLines(hunks: readonly DiffHunk[]): number[] {
  return hunks.flatMap((hunk) =>
    hunk.lines.flatMap((line) => (line.newLine === null ? [] : [line.newLine])),
  )
}

describe('collapseHunks', () => {
  it('keeps only the default context around a change in the middle of a file', () => {
    const { hunks, gaps } = collapseHunks([wholeFileHunk(100, [50])], {
      context: DEFAULT_DIFF_CONTEXT,
    })
    expect(visibleNewLines(hunks)).toEqual([47, 48, 49, 50, 51, 52, 53])
    expect(gaps).toEqual([
      { beforeHunk: 0, count: 46, endNew: 46, expandable: true, startNew: 1 },
      { beforeHunk: 1, count: 47, endNew: 100, expandable: true, startNew: 54 },
    ])
  })

  it('reproduces git’s own 3-line hunks: collapsing an already-narrow diff changes nothing', () => {
    // What `git diff` (default -U3) hands back for the same edit.
    const narrow: DiffHunk = {
      header: '@@ -47,7 +47,7 @@',
      lines: [
        { kind: 'context', newLine: 47, oldLine: 47, text: 'line 47' },
        { kind: 'context', newLine: 48, oldLine: 48, text: 'line 48' },
        { kind: 'context', newLine: 49, oldLine: 49, text: 'line 49' },
        { kind: 'del', newLine: null, oldLine: 50, text: 'old 50' },
        { kind: 'add', newLine: 50, oldLine: null, text: 'new 50' },
        { kind: 'context', newLine: 51, oldLine: 51, text: 'line 51' },
        { kind: 'context', newLine: 52, oldLine: 52, text: 'line 52' },
        { kind: 'context', newLine: 53, oldLine: 53, text: 'line 53' },
      ],
    }
    const collapsed = collapseHunks([wholeFileHunk(100, [50])], { context: DEFAULT_DIFF_CONTEXT })
    expect(collapsed.hunks.flatMap((hunk) => hunk.lines)).toEqual(narrow.lines)
    // And the narrow diff itself survives a round trip untouched.
    expect(collapseHunks([narrow], { context: DEFAULT_DIFF_CONTEXT }).hunks[0]?.lines).toEqual(
      narrow.lines,
    )
  })

  it('splits a file with two distant changes into two stretches and three gaps', () => {
    const { hunks, gaps } = collapseHunks([wholeFileHunk(200, [20, 150])], { context: 1 })
    expect(hunks).toHaveLength(2)
    expect(visibleNewLines(hunks[0]?.lines ? [hunks[0]] : [])).toEqual([19, 20, 21])
    expect(gaps.map((gap) => gap.beforeHunk)).toEqual([0, 1, 2])
    expect(gaps.map((gap) => gap.count)).toEqual([18, 127, 49])
  })

  it('reveals only the requested range', () => {
    const first = collapseHunks([wholeFileHunk(100, [50])], { context: 3 })
    const gap = first.gaps[1]
    if (!gap) throw new Error('expected a trailing gap')
    const revealed = addRange([], revealDown(gap, 5))
    const second = collapseHunks([wholeFileHunk(100, [50])], { context: 3, revealed })
    expect(visibleNewLines(second.hunks)).toEqual([47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58])
    expect(second.gaps.map((g) => g.startNew)).toEqual([1, 59])
  })

  it('shows the whole file once everything is revealed', () => {
    const { hunks, gaps } = collapseHunks([wholeFileHunk(100, [50])], {
      context: 3,
      revealed: allRevealed(),
    })
    expect(gaps).toEqual([])
    expect(visibleNewLines(hunks)).toHaveLength(100)
  })

  it('marks the boundary between narrow hunks as a gap it cannot expand', () => {
    const hunks: DiffHunk[] = [
      {
        header: '@@ -1,2 +1,2 @@',
        lines: [
          { kind: 'add', newLine: 1, oldLine: null, text: 'a' },
          { kind: 'context', newLine: 2, oldLine: 2, text: 'b' },
        ],
      },
      {
        header: '@@ -40,2 +40,2 @@',
        lines: [
          { kind: 'context', newLine: 40, oldLine: 40, text: 'c' },
          { kind: 'add', newLine: 41, oldLine: null, text: 'd' },
        ],
      },
    ]
    const collapsed = collapseHunks(hunks, { context: 3 })
    expect(collapsed.gaps).toEqual([
      { beforeHunk: 1, count: 37, endNew: 39, expandable: false, startNew: 3 },
    ])
  })

  it('drops hunk headers so a whole-file span never poses as a location', () => {
    const { hunks } = collapseHunks([wholeFileHunk(50, [25])], { context: 3 })
    expect(hunks.every((hunk) => hunk.header === '')).toBe(true)
  })
})

describe('reveal ranges', () => {
  const gap = { beforeHunk: 0, count: 100, endNew: 100, expandable: true, startNew: 1 }

  it('expands up from the bottom of the gap and down from the top', () => {
    expect(revealUp(gap, 20)).toEqual({ from: 81, to: 100 })
    expect(revealDown(gap, 20)).toEqual({ from: 1, to: 20 })
    expect(revealWhole(gap)).toEqual({ from: 1, to: 100 })
  })

  it('never runs past a gap smaller than one step', () => {
    const small = { beforeHunk: 0, count: 4, endNew: 14, expandable: true, startNew: 11 }
    expect(revealUp(small, 20)).toEqual({ from: 11, to: 14 })
    expect(revealDown(small, 20)).toEqual({ from: 11, to: 14 })
  })

  it('merges touching ranges', () => {
    expect(addRange([{ from: 1, to: 10 }], { from: 11, to: 20 })).toEqual([{ from: 1, to: 20 }])
    expect(addRange([{ from: 1, to: 10 }], { from: 30, to: 40 })).toEqual([
      { from: 1, to: 10 },
      { from: 30, to: 40 },
    ])
  })
})
