import { describe, expect, it } from 'vitest'

import {
  diffReadingQuery,
  gitCommitDiffQuery,
  gitDiffFileQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitLogQuery,
  reviewedPathsQuery,
} from './changes'

/**
 * Fixtures are shaped like the daemon's own returns (`FlowGroup`, `DiffFileResult`, `Commit`,
 * `HeadRef`, `buildDiffReading`) — the point of the parse is that a daemon which drops a field
 * fails here, legibly, instead of crashing mid-scroll.
 */
const hunk = {
  header: '@@ -1,2 +1,3 @@',
  lines: [
    { kind: 'context', newLine: 1, oldLine: 1, text: 'a' },
    { kind: 'add', newLine: 2, oldLine: null, text: 'b' },
  ],
}

describe('gitFlow', () => {
  it('parses a flow group with the optional working-tree fields', () => {
    const parsed = gitFlowQuery.output.parse([
      {
        files: [
          {
            additions: 3,
            connects: ['src/other.ts'],
            deletions: 1,
            path: 'src/a.ts',
            staged: true,
            status: 'modified',
            unstaged: false,
          },
        ],
        layer: 'Docs',
      },
    ])
    expect(parsed[0]?.files[0]?.path).toBe('src/a.ts')
  })

  it('parses a commit file list, which has no staging state', () => {
    expect(
      gitFlowQuery.output.parse([
        { files: [{ connects: [], path: 'README.md', status: 'added' }], layer: 'Other' },
      ]),
    ).toHaveLength(1)
  })

  it('rejects a status the client has no glyph for', () => {
    expect(() =>
      gitFlowQuery.output.parse([
        { files: [{ connects: [], path: 'a', status: 'copied' }], layer: 'Other' },
      ]),
    ).toThrow()
  })
})

describe('diff shapes', () => {
  it('parses gitDiffFile, which carries status and an optional image', () => {
    const parsed = gitDiffFileQuery.output.parse({
      binary: false,
      hunks: [hunk],
      image: { dataUrl: 'data:image/png;base64,AA' },
      status: 'modified',
    })
    expect(parsed.hunks[0]?.lines).toHaveLength(2)
  })

  it('parses gitCommitDiff, which returns hunks bare', () => {
    expect(gitCommitDiffQuery.output.parse([hunk])).toHaveLength(1)
  })

  it('keeps a deleted line’s null new-line number', () => {
    const parsed = gitCommitDiffQuery.output.parse([
      { header: '@@', lines: [{ kind: 'del', newLine: null, oldLine: 7, text: 'gone' }] },
    ])
    expect(parsed[0]?.lines[0]?.newLine).toBeNull()
  })
})

describe('diffReading', () => {
  it('reads the flow-grouped files and ignores the Review-only half of the document', () => {
    const parsed = diffReadingQuery.output.parse({
      evidence: null,
      groups: [
        {
          files: [
            {
              additions: 1,
              hunks: [hunk],
              path: 'src/a.ts',
              source: 'changed',
              status: 'modified',
            },
          ],
          layer: 'Docs',
        },
      ],
      name: 'Changes',
      sections: [],
    })
    expect(parsed.groups[0]?.files[0]?.hunks).toHaveLength(1)
  })
})

describe('history and head', () => {
  it('parses a commit row', () => {
    expect(
      gitLogQuery.output.parse([
        { author: 'A', date: '2 days ago', hash: 'abc', subject: 'feat: x' },
      ]),
    ).toHaveLength(1)
  })

  it('parses both HEAD shapes', () => {
    expect(gitHeadQuery.output.parse({ branch: 'main', detachedSha: null }).branch).toBe('main')
    expect(gitHeadQuery.output.parse({ branch: null, detachedSha: 'abc1234' }).branch).toBeNull()
  })

  it('parses reviewed paths', () => {
    expect(reviewedPathsQuery.output.parse(['src/a.ts'])).toEqual(['src/a.ts'])
  })
})
