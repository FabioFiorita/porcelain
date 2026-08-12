// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { GitOperations } from './git-operations'
import type { GitProjectResult, GitWorkspaceError } from './git-ports'
import { createGitFeatureRouter } from './git-router'

const REQUEST_ID = '00000000-0000-4000-8000-0000000000b1'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const CHECKOUT_INPUT = { repoPath: '/synthetic/repo', branch: 'main' }
const WORKTREE_INPUT = { repoPath: '/synthetic/repo', branch: 'feature/x' }
const REPO = '/synthetic/repo'

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

function expectPublicCode(error: unknown, code: string, unexpected = false): void {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(unexpected)
  expect(publicErrorSchema.parse(normalized.error)).toMatchObject({
    code,
    requestId: REQUEST_ID,
  })
}

const DIFF_READING = {
  name: 'Changes',
  sections: [] as [],
  evidence: null,
  groups: [] as {
    layer: string
    files: {
      path: string
      source: 'changed'
      status: 'modified'
      additions: number
      deletions: number
      hunks: never[]
    }[]
  }[],
}

const COMMIT_MODELS = [{ id: 'luna', label: 'Luna', provider: 'claude' as const }]

function operations(overrides: Partial<GitOperations> = {}): GitOperations {
  return {
    checkoutGit: vi.fn(async () => ({ ok: true, value: undefined })),
    addGitWorktree: vi.fn(async () => ({
      ok: true,
      value: { path: '/synthetic/repo-worktrees/feature-x', branch: 'feature/x' },
    })),
    quickCommandGit: vi.fn(async () => 'On branch main'),
    pushGit: vi.fn(async () => 'Everything up-to-date'),
    stageAllGit: vi.fn(async () => undefined),
    unstageAllGit: vi.fn(async () => undefined),
    stageFileGit: vi.fn(async () => undefined),
    unstageFileGit: vi.fn(async () => undefined),
    discardFileGit: vi.fn(async () => undefined),
    commitGit: vi.fn(async () => undefined),
    generateCommitMessageGit: vi.fn(async () => 'generated'),
    generateCommitGroupsGit: vi.fn(async () => []),
    commitConventionsGit: vi.fn(async () => ({ types: ['feat'], scopes: ['git'] })),
    statusGit: vi.fn(async (): Promise<GitProjectResult<never[]>> => ({ ok: true, value: [] })),
    suggestionsGit: vi.fn(async () => []),
    headGit: vi.fn(async () => ({ branch: 'main', detachedSha: null })),
    branchesGit: vi.fn(async (): Promise<GitProjectResult<never[]>> => ({ ok: true, value: [] })),
    createBranchGit: vi.fn(async () => undefined),
    worktreesGit: vi.fn(async (): Promise<GitProjectResult<never[]>> => ({ ok: true, value: [] })),
    commitModelsGit: vi.fn(async () => COMMIT_MODELS),
    diffReadingGit: vi.fn(async () => DIFF_READING),
    ...overrides,
  }
}

describe('Git feature router', () => {
  it('calls one bound operation and returns contract-shaped success values', async () => {
    const checkoutGit = vi.fn(async () => ({ ok: true, value: undefined }))
    const addGitWorktree = vi.fn(async () => ({
      ok: true,
      value: { path: '/synthetic/repo-worktrees/feature-x', branch: 'feature/x' },
    }))
    const stageAllGit = vi.fn(async () => undefined)
    const router = createGitFeatureRouter(operations({ checkoutGit, addGitWorktree, stageAllGit }))
    const caller = router.createCaller(PUBLIC_CONTEXT)

    await expect(caller.gitCheckout(CHECKOUT_INPUT)).resolves.toBeUndefined()
    await expect(caller.gitAddWorktree(WORKTREE_INPUT)).resolves.toEqual({
      path: '/synthetic/repo-worktrees/feature-x',
      branch: 'feature/x',
    })
    await expect(caller.gitStageAll({ repoPath: REPO })).resolves.toBeUndefined()
    expect(checkoutGit).toHaveBeenCalledTimes(1)
    expect(checkoutGit).toHaveBeenCalledWith(CHECKOUT_INPUT)
    expect(addGitWorktree).toHaveBeenCalledTimes(1)
    expect(addGitWorktree).toHaveBeenCalledWith(WORKTREE_INPUT)
    expect(stageAllGit).toHaveBeenCalledWith({ repoPath: REPO })
  })

  it('binds every moved Git procedure to its matching operation', async () => {
    const bound = operations()
    const caller = createGitFeatureRouter(bound).createCaller(PUBLIC_CONTEXT)

    await expect(caller.gitQuickCommand({ repoPath: REPO, command: 'status' })).resolves.toBe(
      'On branch main',
    )
    await expect(caller.gitPush({ repoPath: REPO })).resolves.toBe('Everything up-to-date')
    await expect(caller.gitStageAll({ repoPath: REPO })).resolves.toBeUndefined()
    await expect(caller.gitUnstageAll({ repoPath: REPO })).resolves.toBeUndefined()
    await expect(caller.gitStageFile({ repoPath: REPO, path: 'src/a.ts' })).resolves.toBeUndefined()
    await expect(
      caller.gitUnstageFile({ repoPath: REPO, path: 'src/a.ts' }),
    ).resolves.toBeUndefined()
    await expect(
      caller.gitDiscardFile({ repoPath: REPO, path: 'src/a.ts' }),
    ).resolves.toBeUndefined()
    await expect(
      caller.gitCommit({ repoPath: REPO, message: 'feat: test' }),
    ).resolves.toBeUndefined()
    await expect(
      caller.gitGenerateCommitMessage({ repoPath: REPO, model: 'claude' }),
    ).resolves.toEqual({ message: 'generated' })
    await expect(
      caller.gitGenerateCommitGroups({ repoPath: REPO, model: 'claude' }),
    ).resolves.toEqual({ groups: [] })
    await expect(caller.gitCommitConventions(REPO)).resolves.toEqual({
      types: ['feat'],
      scopes: ['git'],
    })
    await expect(caller.gitStatus(REPO)).resolves.toEqual([])
    await expect(caller.gitSuggestions(REPO)).resolves.toEqual([])
    await expect(caller.gitHead(REPO)).resolves.toEqual({ branch: 'main', detachedSha: null })
    await expect(caller.gitBranches(REPO)).resolves.toEqual([])
    await expect(
      caller.gitCreateBranch({ repoPath: REPO, branch: 'feature/new' }),
    ).resolves.toBeUndefined()
    await expect(caller.gitWorktrees(REPO)).resolves.toEqual([])
    await expect(caller.commitModels()).resolves.toEqual(COMMIT_MODELS)
    await expect(
      caller.diffReading({ repoPath: REPO, scope: { type: 'working' } }),
    ).resolves.toEqual(DIFF_READING)

    expect(bound.quickCommandGit).toHaveBeenCalled()
    expect(bound.pushGit).toHaveBeenCalled()
    expect(bound.stageAllGit).toHaveBeenCalled()
    expect(bound.unstageAllGit).toHaveBeenCalled()
    expect(bound.stageFileGit).toHaveBeenCalled()
    expect(bound.unstageFileGit).toHaveBeenCalled()
    expect(bound.discardFileGit).toHaveBeenCalled()
    expect(bound.commitGit).toHaveBeenCalled()
    expect(bound.generateCommitMessageGit).toHaveBeenCalled()
    expect(bound.generateCommitGroupsGit).toHaveBeenCalled()
    expect(bound.commitConventionsGit).toHaveBeenCalled()
    expect(bound.statusGit).toHaveBeenCalled()
    expect(bound.suggestionsGit).toHaveBeenCalled()
    expect(bound.headGit).toHaveBeenCalled()
    expect(bound.branchesGit).toHaveBeenCalled()
    expect(bound.createBranchGit).toHaveBeenCalled()
    expect(bound.worktreesGit).toHaveBeenCalled()
    expect(bound.commitModelsGit).toHaveBeenCalledTimes(1)
    expect(bound.diffReadingGit).toHaveBeenCalledTimes(1)
    expect(bound.diffReadingGit).toHaveBeenCalledWith({
      repoPath: REPO,
      scope: { type: 'working' },
    })
  })

  it('maps every declared workspace failure to its public error', async () => {
    const errors = [
      { code: 'git.not-a-repository' },
      { code: 'git.branch-not-found' },
      { code: 'git.branch-already-exists' },
      { code: 'git.worktree-conflict' },
      { code: 'git.working-tree-conflict' },
    ] satisfies GitWorkspaceError[]

    for (const error of errors) {
      const router = createGitFeatureRouter(
        operations({
          checkoutGit: async () => ({ ok: false, error }),
        }),
      )
      expectPublicCode(
        await rejected(() => router.createCaller(PUBLIC_CONTEXT).gitCheckout(CHECKOUT_INPUT)),
        error.code,
      )
    }
  })

  it('maps the declared project read failures to git.not-a-repository', async () => {
    const error = { code: 'git.not-a-repository' } as const
    for (const key of ['statusGit', 'branchesGit', 'worktreesGit'] as const) {
      const router = createGitFeatureRouter(
        operations({
          [key]: async () => ({ ok: false, error }),
        }),
      )
      const caller = router.createCaller(PUBLIC_CONTEXT)
      const run =
        key === 'statusGit'
          ? () => caller.gitStatus(REPO)
          : key === 'branchesGit'
            ? () => caller.gitBranches(REPO)
            : () => caller.gitWorktrees(REPO)
      expectPublicCode(await rejected(run), error.code)
    }
  })

  it('rejects invalid raw input before invoking an operation', async () => {
    const stageAllGit = vi.fn(async () => undefined)
    const router = createGitFeatureRouter(operations({ stageAllGit }))
    const error = await rejected(() =>
      callTRPCProcedure({
        router,
        path: 'gitStageAll',
        type: 'mutation',
        ctx: PUBLIC_CONTEXT,
        getRawInput: async () => ({ repoPath: '/synthetic/repo', extra: true }),
        signal: undefined,
        batchIndex: 0,
      }),
    )

    expectPublicCode(error, 'request.invalid')
    expect(stageAllGit).not.toHaveBeenCalled()
  })

  it('lets unexpected operation errors reach centralized internal mapping', async () => {
    const router = createGitFeatureRouter(
      operations({
        quickCommandGit: async () => {
          throw new Error('secret native path /home/user/private')
        },
      }),
    )
    const error = await rejected(() =>
      router.createCaller(PUBLIC_CONTEXT).gitQuickCommand({
        repoPath: REPO,
        command: 'status',
      }),
    )

    expectPublicCode(error, 'internal.unexpected', true)
    expect(JSON.stringify(normalizePublicError(error, REQUEST_ID).error)).not.toContain(
      '/home/user/private',
    )
  })

  it('returns contract-shaped success for diffReading and commitModels', async () => {
    const diffReadingGit = vi.fn(async () => DIFF_READING)
    const commitModelsGit = vi.fn(async () => COMMIT_MODELS)
    const caller = createGitFeatureRouter(
      operations({ diffReadingGit, commitModelsGit }),
    ).createCaller(PUBLIC_CONTEXT)

    await expect(
      caller.diffReading({ repoPath: REPO, scope: { type: 'branch' } }),
    ).resolves.toEqual(DIFF_READING)
    await expect(caller.commitModels()).resolves.toEqual(COMMIT_MODELS)
    expect(diffReadingGit).toHaveBeenCalledTimes(1)
    expect(diffReadingGit).toHaveBeenCalledWith({ repoPath: REPO, scope: { type: 'branch' } })
    expect(commitModelsGit).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid diffReading and commitModels input before the operation', async () => {
    const diffReadingGit = vi.fn(async () => DIFF_READING)
    const commitModelsGit = vi.fn(async () => COMMIT_MODELS)
    const router = createGitFeatureRouter(operations({ diffReadingGit, commitModelsGit }))

    expectPublicCode(
      await rejected(() =>
        callTRPCProcedure({
          router,
          path: 'diffReading',
          type: 'query',
          ctx: PUBLIC_CONTEXT,
          getRawInput: async () => ({ repoPath: REPO, scope: { type: 'staged' } }),
          signal: undefined,
          batchIndex: 0,
        }),
      ),
      'request.invalid',
    )
    expectPublicCode(
      await rejected(() =>
        callTRPCProcedure({
          router,
          path: 'commitModels',
          type: 'query',
          ctx: PUBLIC_CONTEXT,
          getRawInput: async () => ({ refresh: true }),
          signal: undefined,
          batchIndex: 0,
        }),
      ),
      'request.invalid',
    )
    expect(diffReadingGit).not.toHaveBeenCalled()
    expect(commitModelsGit).not.toHaveBeenCalled()
  })

  it('redacts unexpected errors from the moved Git reading procedures', async () => {
    const router = createGitFeatureRouter(
      operations({
        diffReadingGit: async () => {
          throw new Error('secret native path /tmp/private-diff')
        },
        commitModelsGit: async () => {
          throw new Error('secret model inventory /home/user/.config')
        },
      }),
    )
    const caller = router.createCaller(PUBLIC_CONTEXT)

    const diffError = await rejected(() =>
      caller.diffReading({ repoPath: REPO, scope: { type: 'working' } }),
    )
    expectPublicCode(diffError, 'internal.unexpected', true)
    expect(JSON.stringify(normalizePublicError(diffError, REQUEST_ID).error)).not.toContain(
      '/tmp/private-diff',
    )

    const modelsError = await rejected(() => caller.commitModels())
    expectPublicCode(modelsError, 'internal.unexpected', true)
    expect(JSON.stringify(normalizePublicError(modelsError, REQUEST_ID).error)).not.toContain(
      '/home/user/.config',
    )
  })
})
