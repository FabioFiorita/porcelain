// @vitest-environment node
import type {
  BranchRef,
  ChangedFile,
  DiffReadingInput,
  GitAddWorktreeInput,
  GitCheckoutInput,
  GitGenerateCommitGroupsOutput,
  GitGenerateCommitMessageInput,
  GitHead,
  GitSuggestion,
  Worktree,
} from '@porcelain/contracts/git'
import { describe, expect, it, vi } from 'vitest'
import type { DiffHunk } from '../../git/diff'
import type { FlowGroup } from '../../review/flow'
import { createGitOperations, type GitOperationDependencies } from './git-operations'
import type {
  CommitGeneration,
  GitChanges,
  GitDiffReadingSources,
  GitProjectError,
  GitProjectResult,
  GitWorkspaceError,
  GitWorkspacePort,
  ProjectGit,
  ReviewMarks,
  WorkingTreeCache,
  WorkspaceTrash,
} from './git-ports'

const CHECKOUT_INPUT: GitCheckoutInput = { repoPath: '/synthetic/repo', branch: 'main' }
const WORKTREE_INPUT: GitAddWorktreeInput = {
  repoPath: '/synthetic/repo',
  branch: 'feature/x',
}
const REPO = '/synthetic/repo'

// Each mock carries the port method's own type. Bare `vi.fn(async () => ({ ok: true, … }))`
// infers `{ ok: boolean }`, collapsing the Git*Result discriminated unions — the fake stays
// assignable while production narrows away from it, and no test notices.
function workspace(overrides: Partial<GitWorkspacePort> = {}): GitWorkspacePort {
  return {
    checkout: vi.fn<GitWorkspacePort['checkout']>(async () => ({ ok: true, value: undefined })),
    addWorktree: vi.fn<GitWorkspacePort['addWorktree']>(async () => ({
      ok: true,
      value: { path: '/synthetic/repo-worktrees/feature-x', branch: 'feature/x' },
    })),
    ...overrides,
  }
}

function projectGit(overrides: Partial<ProjectGit> = {}): ProjectGit {
  return {
    quickCommand: vi.fn<ProjectGit['quickCommand']>(async () => 'On branch main'),
    push: vi.fn<ProjectGit['push']>(async () => 'Everything up-to-date'),
    stageAll: vi.fn<ProjectGit['stageAll']>(async () => undefined),
    unstageAll: vi.fn<ProjectGit['unstageAll']>(async () => undefined),
    stageFile: vi.fn<ProjectGit['stageFile']>(async () => undefined),
    unstageFile: vi.fn<ProjectGit['unstageFile']>(async () => undefined),
    fileInHead: vi.fn<ProjectGit['fileInHead']>(async () => true),
    restoreFromHead: vi.fn<ProjectGit['restoreFromHead']>(async () => undefined),
    resetPath: vi.fn<ProjectGit['resetPath']>(async () => undefined),
    commit: vi.fn<ProjectGit['commit']>(async () => undefined),
    commitFiles: vi.fn<ProjectGit['commitFiles']>(async () => [
      { path: 'src/alpha.ts', status: 'modified' },
    ]),
    status: vi.fn<ProjectGit['status']>(
      async (): Promise<GitProjectResult<ChangedFile[]>> => ({
        ok: true,
        value: [],
      }),
    ),
    suggestions: vi.fn<ProjectGit['suggestions']>(async (): Promise<GitSuggestion[]> => []),
    head: vi.fn<ProjectGit['head']>(
      async (): Promise<GitHead> => ({ branch: 'main', detachedSha: null }),
    ),
    branches: vi.fn<ProjectGit['branches']>(
      async (): Promise<GitProjectResult<BranchRef[]>> => ({
        ok: true,
        value: [],
      }),
    ),
    createBranch: vi.fn<ProjectGit['createBranch']>(async () => undefined),
    worktrees: vi.fn<ProjectGit['worktrees']>(
      async (): Promise<GitProjectResult<Worktree[]>> => ({
        ok: true,
        value: [],
      }),
    ),
    log: vi.fn<ProjectGit['log']>(
      async (): Promise<import('@porcelain/contracts/git').Commit[]> => [],
    ),
    fileLog: vi.fn<ProjectGit['fileLog']>(
      async (): Promise<import('@porcelain/contracts/git').Commit[]> => [],
    ),
    ...overrides,
  }
}

const FLOW_GROUPS: FlowGroup[] = [
  {
    layer: 'source',
    files: [
      { path: 'src/alpha.ts', status: 'modified', additions: 3, deletions: 1, connects: [] },
      { path: 'src/beta.ts', status: 'modified', additions: 1, deletions: 0, connects: [] },
    ],
  },
]

const SAMPLE_HUNK: DiffHunk = {
  header: '@@ -1,1 +1,2 @@',
  lines: [{ kind: 'add', oldLine: null, newLine: 2, text: '+added' }],
}

function diffReadingSources(overrides: Partial<GitDiffReadingSources> = {}): GitDiffReadingSources {
  return {
    loadWorkingFlow: vi.fn<GitDiffReadingSources['loadWorkingFlow']>(async () => FLOW_GROUPS),
    loadRangeFlow: vi.fn<GitDiffReadingSources['loadRangeFlow']>(async () => ({
      groups: FLOW_GROUPS,
      base: 'main',
    })),
    loadCommitFlow: vi.fn<GitDiffReadingSources['loadCommitFlow']>(async () => FLOW_GROUPS),
    workingHunks: vi.fn<GitDiffReadingSources['workingHunks']>(async () => [SAMPLE_HUNK]),
    rangeHunks: vi.fn<GitDiffReadingSources['rangeHunks']>(async () => [SAMPLE_HUNK]),
    diffFile: vi.fn<GitDiffReadingSources['diffFile']>(async () => ({
      hunks: [SAMPLE_HUNK],
      status: 'modified',
    })),
    rangeDiffFile: vi.fn<GitDiffReadingSources['rangeDiffFile']>(async () => ({
      hunks: [SAMPLE_HUNK],
      status: 'modified',
    })),
    commitHunks: vi.fn<GitDiffReadingSources['commitHunks']>(async () => [SAMPLE_HUNK]),
    commitMessage: vi.fn<GitDiffReadingSources['commitMessage']>(
      async () => 'feat(git): land\n\nbody',
    ),
    ...overrides,
  }
}

function dependencies(
  overrides: {
    workspace?: GitWorkspacePort
    projectGit?: ProjectGit
    commitGeneration?: CommitGeneration
    workspaceTrash?: WorkspaceTrash
    reviewMarks?: ReviewMarks
    workingTreeCache?: WorkingTreeCache
    changes?: GitChanges
    diffReadingSources?: GitDiffReadingSources
  } = {},
): GitOperationDependencies {
  return {
    workspace: overrides.workspace ?? workspace(),
    projectGit: overrides.projectGit ?? projectGit(),
    commitGeneration:
      overrides.commitGeneration ??
      ({
        generateMessage: vi.fn(async (_input: GitGenerateCommitMessageInput) => 'generated'),
        generateGroups: vi.fn(async (): Promise<GitGenerateCommitGroupsOutput['groups']> => []),
        listModels: vi.fn<CommitGeneration['listModels']>(async () => [
          { id: 'luna', label: 'Luna', provider: 'claude' },
        ]),
      } satisfies CommitGeneration),
    workspaceTrash:
      overrides.workspaceTrash ??
      ({
        moveToTrash: vi.fn(async () => undefined),
      } satisfies WorkspaceTrash),
    reviewMarks:
      overrides.reviewMarks ??
      ({
        clear: vi.fn(async () => undefined),
      } satisfies ReviewMarks),
    workingTreeCache:
      overrides.workingTreeCache ??
      ({
        clear: vi.fn(() => undefined),
      } satisfies WorkingTreeCache),
    changes:
      overrides.changes ??
      ({
        publishWorkingTreeChanged: vi.fn(() => undefined),
      } satisfies GitChanges),
    diffReadingSources: overrides.diffReadingSources ?? diffReadingSources(),
  }
}

describe('Git operations', () => {
  it('passes checkout and worktree inputs to their workspace capabilities', async () => {
    const port = workspace()
    const operations = createGitOperations(dependencies({ workspace: port }))

    await expect(operations.checkoutGit(CHECKOUT_INPUT)).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    await expect(operations.addGitWorktree(WORKTREE_INPUT)).resolves.toEqual({
      ok: true,
      value: { path: '/synthetic/repo-worktrees/feature-x', branch: 'feature/x' },
    })
    expect(port.checkout).toHaveBeenCalledWith('/synthetic/repo', 'main')
    expect(port.addWorktree).toHaveBeenCalledWith('/synthetic/repo', 'feature/x')
  })

  it('returns each typed workspace failure unchanged', async () => {
    const errors = [
      { code: 'git.not-a-repository' },
      { code: 'git.branch-not-found' },
      { code: 'git.branch-already-exists' },
      { code: 'git.worktree-conflict' },
      { code: 'git.working-tree-conflict' },
    ] satisfies GitWorkspaceError[]

    for (const error of errors) {
      const port = workspace({
        checkout: vi.fn<GitWorkspacePort['checkout']>(async () => ({ ok: false, error })),
        addWorktree: vi.fn<GitWorkspacePort['addWorktree']>(async () => ({ ok: false, error })),
      })
      const operations = createGitOperations(dependencies({ workspace: port }))

      await expect(operations.checkoutGit(CHECKOUT_INPUT)).resolves.toEqual({
        ok: false,
        error,
      })
      await expect(operations.addGitWorktree(WORKTREE_INPUT)).resolves.toEqual({
        ok: false,
        error,
      })
    }
  })

  it('clears and publishes only after successful staging', async () => {
    const events: string[] = []
    const git = projectGit({
      stageAll: async () => {
        events.push('git')
      },
    })
    const cache = { clear: vi.fn(() => events.push('clear')) }
    const changes = { publishWorkingTreeChanged: vi.fn(() => events.push('publish')) }
    const operations = createGitOperations(
      dependencies({ projectGit: git, workingTreeCache: cache, changes }),
    )

    await operations.stageAllGit({ repoPath: REPO })
    expect(events).toEqual(['git', 'clear', 'publish'])
    expect(cache.clear).toHaveBeenCalledWith(REPO)
    expect(changes.publishWorkingTreeChanged).toHaveBeenCalledWith(REPO)
  })

  it('does not clear or publish when a mutation fails', async () => {
    const error = new Error('native failure')
    const git = projectGit({
      stageFile: async () => {
        throw error
      },
    })
    const cache = { clear: vi.fn(() => undefined) }
    const changes = { publishWorkingTreeChanged: vi.fn(() => undefined) }
    const operations = createGitOperations(
      dependencies({ projectGit: git, workingTreeCache: cache, changes }),
    )

    await expect(operations.stageFileGit({ repoPath: REPO, path: 'src/a.ts' })).rejects.toBe(error)
    expect(cache.clear).not.toHaveBeenCalled()
    expect(changes.publishWorkingTreeChanged).not.toHaveBeenCalled()
  })

  it('keeps discard branching and publishes after Trash succeeds', async () => {
    const git = projectGit({
      fileInHead: vi.fn(async () => false),
    })
    const trash = { moveToTrash: vi.fn(async () => undefined) }
    const cache = { clear: vi.fn(() => undefined) }
    const changes = { publishWorkingTreeChanged: vi.fn(() => undefined) }
    const operations = createGitOperations(
      dependencies({
        projectGit: git,
        workspaceTrash: trash,
        workingTreeCache: cache,
        changes,
      }),
    )

    await operations.discardFileGit({ repoPath: REPO, path: 'new.ts' })
    expect(git.resetPath).toHaveBeenCalledWith(REPO, 'new.ts')
    expect(trash.moveToTrash).toHaveBeenCalledWith('/synthetic/repo/new.ts')
    expect(git.restoreFromHead).not.toHaveBeenCalled()
    expect(cache.clear).toHaveBeenCalledWith(REPO)
    expect(changes.publishWorkingTreeChanged).toHaveBeenCalledWith(REPO)
  })

  it('commits, clears cache, clears reviewed marks, then publishes', async () => {
    const events: string[] = []
    const git = projectGit({
      commit: async () => {
        events.push('commit')
      },
      commitFiles: async () => {
        events.push('files')
        return [{ path: 'src/a.ts', status: 'modified' as const }]
      },
    })
    const cache = { clear: vi.fn(() => events.push('cache')) }
    const marks = {
      clear: vi.fn(async () => {
        events.push('marks')
      }),
    }
    const changes = { publishWorkingTreeChanged: vi.fn(() => events.push('publish')) }
    const operations = createGitOperations(
      dependencies({
        projectGit: git,
        workingTreeCache: cache,
        reviewMarks: marks,
        changes,
      }),
    )

    await operations.commitGit({ repoPath: REPO, message: 'feat: test' })
    expect(events).toEqual(['commit', 'cache', 'files', 'marks', 'publish'])
    expect(marks.clear).toHaveBeenCalledWith(REPO, ['src/a.ts'])
  })

  it('keeps a frozen operation catalog', () => {
    expect(Object.isFrozen(createGitOperations(dependencies()))).toBe(true)
  })

  it('retains the typed project read result for repository failures', async () => {
    const error: GitProjectError = { code: 'git.not-a-repository' }
    const git = projectGit({
      status: async () => ({ ok: false, error }),
    })
    const operations = createGitOperations(dependencies({ projectGit: git }))

    await expect(operations.statusGit(REPO)).resolves.toEqual({ ok: false, error })
  })

  it('keeps quick-command cache behavior and only publishes working-tree effects', async () => {
    const cache = { clear: vi.fn(() => undefined) }
    const changes = { publishWorkingTreeChanged: vi.fn(() => undefined) }
    const git = projectGit()
    const operations = createGitOperations(
      dependencies({ projectGit: git, workingTreeCache: cache, changes }),
    )

    await operations.quickCommandGit({
      repoPath: REPO,
      command: 'fetch',
    })
    expect(cache.clear).toHaveBeenCalledWith(REPO)
    expect(changes.publishWorkingTreeChanged).not.toHaveBeenCalled()

    await operations.quickCommandGit({
      repoPath: REPO,
      command: 'pull',
      pullMode: 'merge',
    })
    expect(changes.publishWorkingTreeChanged).toHaveBeenCalledWith(REPO)
  })

  it('delegates the moved flow, diff, and history reads to their ports', async () => {
    const sources = diffReadingSources()
    const git = projectGit()
    const operations = createGitOperations(
      dependencies({ projectGit: git, diffReadingSources: sources }),
    )

    await expect(operations.flowGit(REPO)).resolves.toEqual(FLOW_GROUPS)
    await expect(operations.rangeFlowGit(REPO)).resolves.toEqual({
      groups: FLOW_GROUPS,
      base: 'main',
    })
    await expect(
      operations.rangeDiffFileGit({ repoPath: REPO, base: 'main', filePath: 'src/a.ts' }),
    ).resolves.toEqual({ hunks: [SAMPLE_HUNK], status: 'modified' })
    await expect(operations.diffFileGit({ repoPath: REPO, filePath: 'src/a.ts' })).resolves.toEqual(
      { hunks: [SAMPLE_HUNK], status: 'modified' },
    )
    await expect(operations.logGit({ repoPath: REPO, limit: 20 })).resolves.toEqual([])
    await expect(
      operations.commitMessageGit({ repoPath: REPO, hash: 'abcdef123456' }),
    ).resolves.toBe('feat(git): land\n\nbody')
    await expect(
      operations.fileLogGit({ repoPath: REPO, filePath: 'src/a.ts', limit: 20 }),
    ).resolves.toEqual([])
    await expect(
      operations.commitDiffGit({ repoPath: REPO, hash: 'abcdef123456', filePath: 'src/a.ts' }),
    ).resolves.toEqual([SAMPLE_HUNK])
    await expect(
      operations.commitFlowGit({ repoPath: REPO, hash: 'abcdef123456' }),
    ).resolves.toEqual(FLOW_GROUPS)

    expect(sources.loadWorkingFlow).toHaveBeenCalledWith(REPO)
    expect(sources.loadRangeFlow).toHaveBeenCalledWith(REPO)
    expect(sources.rangeDiffFile).toHaveBeenCalledWith(REPO, 'main', 'src/a.ts')
    expect(sources.diffFile).toHaveBeenCalledWith(REPO, 'src/a.ts')
    expect(git.log).toHaveBeenCalledWith(REPO, 20)
    expect(sources.commitMessage).toHaveBeenCalledWith(REPO, 'abcdef123456')
    expect(git.fileLog).toHaveBeenCalledWith(REPO, 'src/a.ts', 20)
    expect(sources.commitHunks).toHaveBeenCalledWith(REPO, 'abcdef123456', 'src/a.ts')
    expect(sources.loadCommitFlow).toHaveBeenCalledWith(REPO, 'abcdef123456')
  })

  it('delegates commitModelsGit to listModels once', async () => {
    const models = [{ id: 'sonnet', label: 'Sonnet', provider: 'claude' as const }]
    const listModels = vi.fn(async () => models)
    const operations = createGitOperations(
      dependencies({
        commitGeneration: {
          generateMessage: vi.fn(async () => 'generated'),
          generateGroups: vi.fn(async () => []),
          listModels,
        },
      }),
    )

    await expect(operations.commitModelsGit()).resolves.toEqual(models)
    expect(listModels).toHaveBeenCalledTimes(1)
  })

  it('builds a working-scope diff reading with Changes title and parallel hunks', async () => {
    const sources = diffReadingSources()
    const operations = createGitOperations(dependencies({ diffReadingSources: sources }))
    const input: DiffReadingInput = { repoPath: REPO, scope: { type: 'working' } }

    await expect(operations.diffReadingGit(input)).resolves.toEqual({
      name: 'Changes',
      sections: [],
      evidence: null,
      groups: [
        {
          layer: 'source',
          files: [
            {
              path: 'src/alpha.ts',
              source: 'changed',
              status: 'modified',
              additions: 3,
              deletions: 1,
              hunks: [SAMPLE_HUNK],
            },
            {
              path: 'src/beta.ts',
              source: 'changed',
              status: 'modified',
              additions: 1,
              deletions: 0,
              hunks: [SAMPLE_HUNK],
            },
          ],
        },
      ],
    })
    expect(sources.loadWorkingFlow).toHaveBeenCalledWith(REPO)
    expect(sources.workingHunks).toHaveBeenCalledWith(REPO, 'src/alpha.ts')
    expect(sources.workingHunks).toHaveBeenCalledWith(REPO, 'src/beta.ts')
    expect(sources.loadRangeFlow).not.toHaveBeenCalled()
    expect(sources.loadCommitFlow).not.toHaveBeenCalled()
  })

  it('titles a branch-scope reading vs the range base', async () => {
    const sources = diffReadingSources()
    const operations = createGitOperations(dependencies({ diffReadingSources: sources }))

    await expect(
      operations.diffReadingGit({ repoPath: REPO, scope: { type: 'branch' } }),
    ).resolves.toMatchObject({ name: 'vs main' })
    expect(sources.loadRangeFlow).toHaveBeenCalledWith(REPO)
    expect(sources.rangeHunks).toHaveBeenCalledWith(REPO, 'main', 'src/alpha.ts')
  })

  it('titles a commit-scope reading from the first message line or short hash', async () => {
    const withMessage = diffReadingSources({
      commitMessage: vi.fn(async () => 'fix(auth): lock session\n\ndetail'),
    })
    const operations = createGitOperations(dependencies({ diffReadingSources: withMessage }))
    const hash = 'abcdef1234567890'

    await expect(
      operations.diffReadingGit({ repoPath: REPO, scope: { type: 'commit', hash } }),
    ).resolves.toMatchObject({ name: 'fix(auth): lock session' })
    expect(withMessage.loadCommitFlow).toHaveBeenCalledWith(REPO, hash)
    expect(withMessage.commitHunks).toHaveBeenCalledWith(REPO, hash, 'src/alpha.ts')

    const emptyMessage = diffReadingSources({
      commitMessage: vi.fn(async () => '   \n'),
    })
    await expect(
      createGitOperations(dependencies({ diffReadingSources: emptyMessage })).diffReadingGit({
        repoPath: REPO,
        scope: { type: 'commit', hash },
      }),
    ).resolves.toMatchObject({ name: hash.slice(0, 12) })
  })

  it('recovers vanished-file hunks as empty without failing the reading', async () => {
    const sources = diffReadingSources({
      workingHunks: vi.fn(async (_repoPath, path) => {
        if (path === 'src/beta.ts') throw new Error('path vanished')
        return [SAMPLE_HUNK]
      }),
    })
    const operations = createGitOperations(dependencies({ diffReadingSources: sources }))
    const reading = await operations.diffReadingGit({
      repoPath: REPO,
      scope: { type: 'working' },
    })

    expect(reading.groups[0]?.files[0]?.hunks).toEqual([SAMPLE_HUNK])
    expect(reading.groups[0]?.files[1]?.hunks).toEqual([])
  })

  it('does not call hunk helpers when flow load fails and never publishes', async () => {
    const error = new Error('flow load failed')
    const sources = diffReadingSources({
      loadWorkingFlow: vi.fn(async () => {
        throw error
      }),
    })
    const changes = { publishWorkingTreeChanged: vi.fn(() => undefined) }
    const cache = { clear: vi.fn(() => undefined) }
    const operations = createGitOperations(
      dependencies({ diffReadingSources: sources, changes, workingTreeCache: cache }),
    )

    await expect(
      operations.diffReadingGit({ repoPath: REPO, scope: { type: 'working' } }),
    ).rejects.toBe(error)
    expect(sources.workingHunks).not.toHaveBeenCalled()
    expect(cache.clear).not.toHaveBeenCalled()
    expect(changes.publishWorkingTreeChanged).not.toHaveBeenCalled()
  })
})
