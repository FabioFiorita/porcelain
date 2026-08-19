import { describe, expect, it } from 'vitest'
import { gitContractFixtures } from './git.contract'
import { gitProcedures } from './git.procedures'

const expectedKinds = {
  gitQuickCommand: 'mutation',
  gitPush: 'mutation',
  gitStageAll: 'mutation',
  gitUnstageAll: 'mutation',
  gitStageFile: 'mutation',
  gitUnstageFile: 'mutation',
  gitDiscardFile: 'mutation',
  gitCommit: 'mutation',
  gitGenerateCommitMessage: 'mutation',
  gitGenerateCommitGroups: 'mutation',
  gitApplyCommitGroups: 'mutation',
  gitCheckout: 'mutation',
  gitCreateBranch: 'mutation',
  gitAddWorktree: 'mutation',
  gitCommitConventions: 'query',
  gitStatus: 'query',
  gitSuggestions: 'query',
  gitFlow: 'query',
  gitRangeFlow: 'query',
  gitRangeDiffFile: 'query',
  gitDiffFile: 'query',
  gitHead: 'query',
  gitBranches: 'query',
  gitWorktrees: 'query',
  gitLog: 'query',
  gitCommitMessage: 'query',
  gitFileLog: 'query',
  gitCommitDiff: 'query',
  gitCommitFlow: 'query',
  diffReading: 'query',
  commitModels: 'query',
} as const

const expectedErrors = {
  gitQuickCommand: [],
  gitPush: [],
  gitStageAll: [],
  gitUnstageAll: [],
  gitStageFile: [],
  gitUnstageFile: [],
  gitDiscardFile: [],
  gitCommit: [],
  gitGenerateCommitMessage: [],
  gitGenerateCommitGroups: [],
  gitApplyCommitGroups: [],
  gitCheckout: ['git.not-a-repository', 'git.branch-not-found', 'git.working-tree-conflict'],
  gitCreateBranch: [],
  gitAddWorktree: ['git.not-a-repository', 'git.branch-already-exists', 'git.worktree-conflict'],
  gitCommitConventions: [],
  gitStatus: ['git.not-a-repository'],
  gitSuggestions: [],
  gitFlow: [],
  gitRangeFlow: [],
  gitRangeDiffFile: [],
  gitDiffFile: [],
  gitHead: [],
  gitBranches: ['git.not-a-repository'],
  gitWorktrees: ['git.not-a-repository'],
  gitLog: [],
  gitCommitMessage: [],
  gitFileLog: [],
  gitCommitDiff: [],
  gitCommitFlow: [],
  diffReading: [],
  commitModels: [],
} as const

const invalidInputs: Record<keyof typeof gitProcedures, unknown> = {
  gitQuickCommand: { repoPath: '/synthetic/repo', command: 'publish' },
  gitPush: 42,
  gitStageAll: { repoPath: '/synthetic/repo', extra: true },
  gitUnstageAll: null,
  gitStageFile: { repoPath: '/synthetic/repo', path: 42 },
  gitUnstageFile: { repoPath: '/synthetic/repo' },
  gitDiscardFile: { repoPath: 42, path: 'src/example.ts' },
  gitCommit: { repoPath: '/synthetic/repo', message: '   ' },
  gitGenerateCommitMessage: { repoPath: '/synthetic/repo', model: '' },
  gitGenerateCommitGroups: { repoPath: '/synthetic/repo', model: 42 },
  gitApplyCommitGroups: { repoPath: '/synthetic/repo', groups: [] },
  gitCheckout: { repoPath: '/synthetic/repo', branch: 42 },
  gitCreateBranch: { repoPath: '/synthetic/repo', branch: '' },
  gitAddWorktree: { repoPath: '/synthetic/repo', branch: '' },
  gitCommitConventions: 42,
  gitStatus: null,
  gitSuggestions: 42,
  gitFlow: null,
  gitRangeFlow: 42,
  gitRangeDiffFile: {
    repoPath: '/synthetic/repo',
    base: 'origin/main',
    filePath: 42,
  },
  gitDiffFile: { repoPath: '/synthetic/repo' },
  gitHead: null,
  gitBranches: 42,
  gitWorktrees: null,
  gitLog: { repoPath: '/synthetic/repo', limit: 1.5 },
  gitCommitMessage: { repoPath: '/synthetic/repo' },
  gitFileLog: { repoPath: '/synthetic/repo', filePath: 'src/example.ts', limit: 201 },
  gitCommitDiff: { repoPath: '/synthetic/repo', hash: 'abc123', filePath: 42 },
  gitCommitFlow: { repoPath: '/synthetic/repo', hash: 42 },
  diffReading: { repoPath: '/synthetic/repo', scope: { type: 'other' } },
  commitModels: null,
}

const invalidOutputs: Record<keyof typeof gitProcedures, unknown> = {
  gitQuickCommand: 42,
  gitPush: 42,
  gitStageAll: null,
  gitUnstageAll: null,
  gitStageFile: null,
  gitUnstageFile: null,
  gitDiscardFile: null,
  gitCommit: null,
  gitGenerateCommitMessage: { message: 42 },
  gitGenerateCommitGroups: { groups: [{ files: [42], message: 'feat: invalid' }] },
  gitApplyCommitGroups: {
    results: [{ files: [], message: 'feat: invalid', status: 'pending', error: null }],
  },
  gitCheckout: null,
  gitCreateBranch: null,
  gitAddWorktree: { path: '/synthetic/repo-worktrees/topic', branch: 42 },
  gitCommitConventions: { scopes: [42], types: [] },
  gitStatus: [{ path: 'src/example.ts', status: 'copied' }],
  gitSuggestions: [{ command: 'pull' }],
  gitFlow: [{ layer: 'Other', files: [{ path: 'src/example.ts', status: 'modified' }] }],
  gitRangeFlow: { groups: [], base: 42, defaultBase: 'main' },
  gitRangeDiffFile: { hunks: [], status: 'copied' },
  gitDiffFile: { hunks: [{ header: '@@', lines: [] }], status: 'modified', image: null },
  gitHead: { branch: 'main' },
  gitBranches: [{ name: 'main', remote: 42 }],
  gitWorktrees: [{ path: '/synthetic/repo', branch: 42 }],
  gitLog: [{ hash: 'abc123', author: 'Synthetic Author', date: 42, subject: 'feat: invalid' }],
  gitCommitMessage: 42,
  gitFileLog: [{ hash: 'abc123', author: 'Synthetic Author', date: '2 days ago' }],
  gitCommitDiff: [{ header: '@@', lines: [{ kind: 'move', oldLine: 1, newLine: 1, text: 'x' }] }],
  gitCommitFlow: [{ layer: 'Other', files: [{ path: 'src/example.ts', status: 'modified' }] }],
  diffReading: {
    ...gitContractFixtures.diffReading.output,
    groups: [
      {
        ...gitContractFixtures.diffReading.output.groups[0],
        files: [
          {
            ...gitContractFixtures.diffReading.output.groups[0].files[0],
            source: 'context',
          },
        ],
      },
    ],
  },
  commitModels: [{ id: 'sonnet', label: 'Sonnet', provider: 'unknown' }],
}

describe('Git procedure contracts', () => {
  it('declares exactly thirty procedures with their router kinds and allowed errors', () => {
    expect(Object.keys(gitProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      const procedure = gitProcedures[name as keyof typeof gitProcedures]
      expect(procedure.kind).toBe(kind)
      expect([...procedure.errors]).toEqual([
        ...expectedErrors[name as keyof typeof expectedErrors],
      ])
    }
  })

  for (const name of Object.keys(gitProcedures) as Array<keyof typeof gitProcedures>) {
    it(`accepts valid ${name} input and output fixtures`, () => {
      const fixture = gitContractFixtures[name]
      const procedure = gitProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })

    it(`rejects invalid ${name} input and output fixtures`, () => {
      const procedure = gitProcedures[name]
      expect(procedure.input.safeParse(invalidInputs[name]).success).toBe(false)
      expect(procedure.output.safeParse(invalidOutputs[name]).success).toBe(false)
    })
  }

  it('preserves history defaults and maximum limits', () => {
    expect(gitProcedures.gitLog.input.parse({ repoPath: '/synthetic/repo' })).toEqual({
      repoPath: '/synthetic/repo',
      limit: 200,
    })
    expect(
      gitProcedures.gitLog.input.safeParse({ repoPath: '/synthetic/repo', limit: 500 }).success,
    ).toBe(true)
    expect(
      gitProcedures.gitLog.input.safeParse({ repoPath: '/synthetic/repo', limit: 501 }).success,
    ).toBe(false)

    expect(
      gitProcedures.gitFileLog.input.parse({
        repoPath: '/synthetic/repo',
        filePath: 'src/example.ts',
      }),
    ).toEqual({ repoPath: '/synthetic/repo', filePath: 'src/example.ts', limit: 50 })
    expect(
      gitProcedures.gitFileLog.input.safeParse({
        repoPath: '/synthetic/repo',
        filePath: 'src/example.ts',
        limit: 200,
      }).success,
    ).toBe(true)
    expect(
      gitProcedures.gitFileLog.input.safeParse({
        repoPath: '/synthetic/repo',
        filePath: 'src/example.ts',
        limit: 201,
      }).success,
    ).toBe(false)
  })

  it('preserves mutation bounds and normalization', () => {
    expect(
      gitProcedures.gitCommit.input.parse({
        repoPath: '/synthetic/repo',
        message: '  feat: trimmed  ',
      }),
    ).toEqual({ repoPath: '/synthetic/repo', message: 'feat: trimmed' })
    expect(
      gitProcedures.gitQuickCommand.input.safeParse({
        repoPath: '/synthetic/repo',
        command: 'status',
      }).success,
    ).toBe(true)
    expect(
      gitProcedures.gitQuickCommand.input.safeParse({
        repoPath: '/synthetic/repo',
        command: 'unknown',
      }).success,
    ).toBe(false)
    expect(
      gitProcedures.gitCreateBranch.input.safeParse({
        repoPath: '/synthetic/repo',
        branch: '',
      }).success,
    ).toBe(false)
    expect(
      gitProcedures.gitCheckout.input.safeParse({
        repoPath: '/synthetic/repo',
        branch: '',
      }).success,
    ).toBe(true)
  })

  it('accepts every flow, status, diff, and reading discriminator', () => {
    for (const status of ['modified', 'added', 'deleted', 'renamed', 'untracked'] as const) {
      expect(
        gitProcedures.gitStatus.output.safeParse([
          { path: 'src/example.ts', status, staged: false, unstaged: true },
        ]).success,
      ).toBe(true)
      expect(
        gitProcedures.gitFlow.output.safeParse([
          { layer: 'Other', files: [{ path: 'src/example.ts', status, connects: [] }] },
        ]).success,
      ).toBe(true)
      expect(gitProcedures.gitDiffFile.output.safeParse({ hunks: [], status }).success).toBe(true)
    }

    for (const kind of ['context', 'add', 'del'] as const) {
      expect(
        gitProcedures.gitCommitDiff.output.safeParse([
          { header: '@@', lines: [{ kind, oldLine: null, newLine: null, text: 'x' }] },
        ]).success,
      ).toBe(true)
    }

    for (const scope of [
      { type: 'working' },
      { type: 'branch' },
      { type: 'commit', hash: 'abc123' },
    ] as const) {
      expect(
        gitProcedures.diffReading.input.safeParse({ repoPath: '/synthetic/repo', scope }).success,
      ).toBe(true)
    }
  })

  it('rejects unknown fields in nested Git wire values', () => {
    const flow = gitContractFixtures.gitFlow.output[0]
    const hunk = gitContractFixtures.gitDiffFile.output.hunks[0]
    expect(
      gitProcedures.gitStatus.output.safeParse([
        { ...gitContractFixtures.gitStatus.output[0], extra: true },
      ]).success,
    ).toBe(false)
    expect(
      gitProcedures.gitFlow.output.safeParse([
        { ...flow, files: [{ ...flow.files[0], extra: true }] },
      ]).success,
    ).toBe(false)
    expect(
      gitProcedures.gitDiffFile.output.safeParse({
        ...gitContractFixtures.gitDiffFile.output,
        hunks: [{ ...hunk, lines: [{ ...hunk.lines[0], extra: true }] }],
      }).success,
    ).toBe(false)
    expect(
      gitProcedures.gitBranches.output.safeParse([
        { ...gitContractFixtures.gitBranches.output[0], extra: true },
      ]).success,
    ).toBe(false)
    expect(
      gitProcedures.gitLog.output.safeParse([
        { ...gitContractFixtures.gitLog.output[0], extra: true },
      ]).success,
    ).toBe(false)
    expect(
      gitProcedures.gitGenerateCommitGroups.output.safeParse({
        groups: [{ files: ['src/example.ts'], message: 'feat: group', extra: true }],
      }).success,
    ).toBe(false)
    expect(
      gitProcedures.commitModels.output.safeParse([
        { ...gitContractFixtures.commitModels.output[0], extra: true },
      ]).success,
    ).toBe(false)
    expect(
      gitProcedures.diffReading.output.safeParse({
        ...gitContractFixtures.diffReading.output,
        groups: [
          {
            ...gitContractFixtures.diffReading.output.groups[0],
            files: [
              {
                ...gitContractFixtures.diffReading.output.groups[0].files[0],
                extra: true,
              },
            ],
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      gitProcedures.gitCommit.input.safeParse({
        ...gitContractFixtures.gitCommit.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      gitProcedures.diffReading.input.safeParse({
        repoPath: '/synthetic/repo',
        scope: { type: 'commit', hash: 'abc123', extra: true },
      }).success,
    ).toBe(false)
  })
})
