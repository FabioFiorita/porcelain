const diffHunkFixture = {
  header: '@@ -1,1 +1,1 @@',
  lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'synthetic change' }],
} as const

const flowFileFixture = {
  path: 'src/example.ts',
  status: 'modified',
  staged: true,
  unstaged: false,
  additions: 1,
  deletions: 0,
  connects: ['src/other.ts'],
} as const

const flowGroupFixture = { layer: 'Other', files: [flowFileFixture] } as const
const commitFixture = {
  hash: 'abc123',
  author: 'Synthetic Author',
  date: '2 days ago',
  subject: 'feat: synthetic change',
} as const

/** Representative Git wire values used by contract tests and client mocks. */
export const gitContractFixtures = {
  gitQuickCommand: {
    input: { repoPath: '/synthetic/repo', command: 'pull', pullMode: 'rebase' },
    output: 'Already up to date.',
  },
  gitPush: { input: { repoPath: '/synthetic/repo' }, output: 'Everything up-to-date' },
  gitStageAll: { input: { repoPath: '/synthetic/repo' }, output: undefined },
  gitUnstageAll: { input: { repoPath: '/synthetic/repo' }, output: undefined },
  gitStageFile: {
    input: { repoPath: '/synthetic/repo', path: 'src/example.ts' },
    output: undefined,
  },
  gitUnstageFile: {
    input: { repoPath: '/synthetic/repo', path: '/synthetic/repo/src/example.ts' },
    output: undefined,
  },
  gitDiscardFile: {
    input: { repoPath: '/synthetic/repo', path: 'src/old.ts' },
    output: undefined,
  },
  gitCommit: {
    input: { repoPath: '/synthetic/repo', message: 'feat: synthetic commit' },
    output: undefined,
  },
  gitGenerateCommitMessage: {
    input: { repoPath: '/synthetic/repo', model: 'sonnet' },
    output: { message: 'feat: synthetic commit' },
  },
  gitGenerateCommitGroups: {
    input: { repoPath: '/synthetic/repo', model: 'sonnet' },
    output: { groups: [{ files: ['src/example.ts'], message: 'feat: synthetic group' }] },
  },
  gitCheckout: {
    input: { repoPath: '/synthetic/repo', branch: 'main' },
    output: undefined,
  },
  gitCreateBranch: {
    input: { repoPath: '/synthetic/repo', branch: 'topic/synthetic' },
    output: undefined,
  },
  gitAddWorktree: {
    input: { repoPath: '/synthetic/repo', branch: 'topic/synthetic' },
    output: { path: '/synthetic/repo-worktrees/topic-synthetic', branch: 'topic/synthetic' },
  },
  gitCommitConventions: {
    input: '/synthetic/repo',
    output: { scopes: ['git'], types: ['feat', 'fix'] },
  },
  gitStatus: {
    input: '/synthetic/repo',
    output: [
      { path: 'src/example.ts', status: 'modified', staged: true, unstaged: false },
      { path: 'README.md', status: 'untracked', staged: false, unstaged: true },
    ],
  },
  gitSuggestions: {
    input: '/synthetic/repo',
    output: [{ command: 'pull', reason: 'behind upstream by 1 commit' }],
  },
  gitFlow: { input: '/synthetic/repo', output: [flowGroupFixture] },
  gitRangeFlow: {
    input: { repoPath: '/synthetic/repo' },
    output: { groups: [flowGroupFixture], base: 'origin/main', defaultBase: 'origin/main' },
  },
  gitRangeDiffFile: {
    input: { repoPath: '/synthetic/repo', base: 'origin/main', filePath: 'src/example.ts' },
    output: { hunks: [diffHunkFixture], status: 'modified' },
  },
  gitDiffFile: {
    input: { repoPath: '/synthetic/repo', filePath: 'src/example.ts' },
    output: { hunks: [diffHunkFixture], status: 'modified', binary: false },
  },
  gitHead: {
    input: '/synthetic/repo',
    output: { branch: 'main', detachedSha: null, upstream: 'origin/main' },
  },
  gitBranches: {
    input: '/synthetic/repo',
    output: [
      { name: 'main', remote: null },
      { name: 'topic/synthetic', remote: 'origin' },
    ],
  },
  gitWorktrees: {
    input: '/synthetic/repo',
    output: [{ path: '/synthetic/repo', branch: 'main' }],
  },
  gitLog: { input: { repoPath: '/synthetic/repo' }, output: [commitFixture] },
  gitCommitMessage: {
    input: { repoPath: '/synthetic/repo', hash: 'abc123' },
    output: `feat: synthetic commit

Body line`,
  },
  gitFileLog: {
    input: { repoPath: '/synthetic/repo', filePath: 'src/example.ts' },
    output: [commitFixture],
  },
  gitCommitDiff: {
    input: { repoPath: '/synthetic/repo', hash: 'abc123', filePath: 'src/example.ts' },
    output: [diffHunkFixture],
  },
  gitCommitFlow: {
    input: { repoPath: '/synthetic/repo', hash: 'abc123' },
    output: [flowGroupFixture],
  },
  diffReading: {
    input: { repoPath: '/synthetic/repo', scope: { type: 'working' } },
    output: {
      name: 'Changes',
      sections: [],
      evidence: null,
      groups: [
        {
          layer: 'Other',
          files: [
            {
              path: 'src/example.ts',
              source: 'changed',
              status: 'modified',
              additions: 1,
              deletions: 0,
              hunks: [diffHunkFixture],
            },
          ],
        },
      ],
    },
  },
  commitModels: {
    input: undefined,
    output: [
      { id: 'sonnet', label: 'Sonnet', provider: 'claude' },
      { id: 'opencode:synthetic/model', label: 'Synthetic (synthetic)', provider: 'opencode' },
    ],
  },
} as const
