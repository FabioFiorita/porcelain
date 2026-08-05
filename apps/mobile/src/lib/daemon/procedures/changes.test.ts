import { describe, expect, it } from 'vitest'

import {
  diffReadingQuery,
  gitCommitConventionsQuery,
  gitCommitDiffQuery,
  gitCommitMutation,
  gitDiffFileQuery,
  gitDiscardFileMutation,
  gitFlowQuery,
  gitGenerateCommitGroupsMutation,
  gitGenerateCommitMessageMutation,
  gitHeadQuery,
  gitLogQuery,
  gitPushMutation,
  gitQuickCommandMutation,
  gitRangeDiffFileQuery,
  gitRangeFlowQuery,
  gitStageAllMutation,
  gitStageFileMutation,
  gitSuggestionsQuery,
  gitUnstageAllMutation,
  gitUnstageFileMutation,
  markReviewedMutation,
  reviewedPathsQuery,
  setReviewedMutation,
  unmarkReviewedMutation,
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

describe('gitRangeFlow', () => {
  it('parses the branch range: flow groups plus the base they are measured against', () => {
    const parsed = gitRangeFlowQuery.output.parse({
      base: 'origin/main',
      groups: [{ files: [{ connects: [], path: 'src/a.ts', status: 'modified' }], layer: 'Other' }],
    })
    expect(parsed.base).toBe('origin/main')
    expect(parsed.groups[0]?.files).toHaveLength(1)
  })

  it('rejects a range with no base — the header has nothing to name without it', () => {
    expect(() => gitRangeFlowQuery.output.parse({ groups: [] })).toThrow()
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

  it('parses gitRangeDiffFile with the same shape as the working-tree read', () => {
    const parsed = gitRangeDiffFileQuery.output.parse({ hunks: [hunk], status: 'added' })
    expect(parsed.status).toBe('added')
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

describe('change mutations and action queries', () => {
  it('uses the daemon procedure names and output shapes', () => {
    expect(gitStageAllMutation.name).toBe('gitStageAll')
    expect(gitUnstageAllMutation.name).toBe('gitUnstageAll')
    expect(gitStageFileMutation.name).toBe('gitStageFile')
    expect(gitUnstageFileMutation.name).toBe('gitUnstageFile')
    expect(gitDiscardFileMutation.name).toBe('gitDiscardFile')
    expect(gitCommitMutation.name).toBe('gitCommit')
    expect(gitPushMutation.output.parse('pushed')).toBe('pushed')
    expect(gitQuickCommandMutation.name).toBe('gitQuickCommand')
    expect(gitQuickCommandMutation.output.parse('On branch main')).toBe('On branch main')
    expect(markReviewedMutation.name).toBe('markReviewed')
    expect(unmarkReviewedMutation.name).toBe('unmarkReviewed')
    expect(setReviewedMutation.name).toBe('setReviewed')
    expect(gitCommitConventionsQuery.output.parse({ scopes: ['mobile'], types: ['feat'] })).toEqual(
      {
        scopes: ['mobile'],
        types: ['feat'],
      },
    )
    expect(
      gitSuggestionsQuery.output.parse([{ command: 'push', reason: '1 unpushed commit' }]),
    ).toEqual([{ command: 'push', reason: '1 unpushed commit' }])
  })
})

describe('commit generation', () => {
  it('parses a generated message', () => {
    expect(
      gitGenerateCommitMessageMutation.output.parse({ message: 'feat(mobile): changes tab' })
        .message,
    ).toBe('feat(mobile): changes tab')
  })

  it('parses generated groups, each a file set with its own message', () => {
    const parsed = gitGenerateCommitGroupsMutation.output.parse({
      groups: [{ files: ['a.ts', 'b.ts'], message: 'fix: a' }],
    })
    expect(parsed.groups[0]?.files).toEqual(['a.ts', 'b.ts'])
  })

  it('rejects a group with no message — there would be nothing to commit with', () => {
    expect(() =>
      gitGenerateCommitGroupsMutation.output.parse({ groups: [{ files: ['a.ts'] }] }),
    ).toThrow()
  })
})
