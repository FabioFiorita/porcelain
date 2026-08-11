// @vitest-environment node
import { procedureCatalog, publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

// This suite owns the tRPC contract seam only: which raw wire input the Git router accepts and
// which resolver result it will serialize. Every Git spawn, Trash move, snapshot clear and
// reviewed-store write is mocked, so nothing here runs Git against a real checkout.
const { git, generation, flow, inbox, trash, workingTree, reviewed } = vi.hoisted(() => ({
  git: {
    gitQuickCommand: vi.fn(async () => 'On branch main'),
    gitPush: vi.fn(async () => 'Everything up-to-date'),
    gitStageAll: vi.fn(async () => undefined),
    gitUnstageAll: vi.fn(async () => undefined),
    gitStageFile: vi.fn(async () => undefined),
    gitUnstageFile: vi.fn(async () => undefined),
    gitFileInHead: vi.fn(async () => true),
    gitRestoreFromHead: vi.fn(async () => undefined),
    gitResetPath: vi.fn(async () => undefined),
    gitCommit: vi.fn(async () => undefined),
    gitCommitFiles: vi.fn(async () => [{ path: 'src/alpha.ts', status: 'modified' }]),
    gitStatus: vi.fn(async () => [
      { path: 'src/alpha.ts', status: 'modified', staged: true, unstaged: false },
    ]),
    gitSuggestions: vi.fn(async () => [{ command: 'git pull', reason: 'behind upstream' }]),
    gitRangeDiffFile: vi.fn(async () => ({ hunks: [], status: 'modified' })),
    gitDiffFile: vi.fn(async () => ({ hunks: [], status: 'modified' })),
    gitHead: vi.fn(async () => ({ branch: 'main', detachedSha: null })),
    gitBranches: vi.fn(async () => [{ name: 'main', remote: 'origin/main' }]),
    gitCheckout: vi.fn(async () => undefined),
    gitCreateBranch: vi.fn(async () => undefined),
    gitWorktrees: vi.fn(async () => [{ path: '/synthetic/repo', branch: 'main' }]),
    gitAddWorktree: vi.fn(async () => ({ path: '/synthetic/repo-work', branch: 'work/alpha' })),
    gitLog: vi.fn(async () => [
      { hash: 'abc1234', author: 'Agent', date: '2 days ago', subject: 'feat(git): add' },
    ]),
    gitCommitMessage: vi.fn(async () => 'feat(git): add\n\nbody'),
    gitFileLog: vi.fn(async () => [
      { hash: 'abc1234', author: 'Agent', date: '2 days ago', subject: 'feat(git): add' },
    ]),
    gitCommitDiff: vi.fn(async () => [{ header: '@@ -1 +1 @@', lines: [] }]),
  },
  generation: {
    generateCommitMessage: vi.fn(async () => 'feat(git): generated'),
    generateCommitGroups: vi.fn(async () => [
      { files: ['src/alpha.ts'], message: 'feat(git): group' },
    ]),
  },
  flow: {
    loadWorkingFlow: vi.fn(async () => [
      { layer: 'source', files: [{ path: 'src/alpha.ts', status: 'modified', connects: [] }] },
    ]),
    loadRangeFlow: vi.fn(async () => ({ groups: [], base: 'main' })),
    loadCommitFlow: vi.fn(async () => []),
  },
  inbox: {
    worktreeInbox: vi.fn(async () => [
      { path: '/synthetic/repo-work', branch: 'work/alpha', changedCount: 3, hasReview: true },
    ]),
  },
  trash: { moveToTrash: vi.fn(async () => undefined) },
  workingTree: { clearWorkingTreeSnapshot: vi.fn(() => undefined) },
  reviewed: { clearReviewedPaths: vi.fn(async () => undefined) },
}))

vi.mock('../git/git', () => git)
vi.mock('../git/commit-generation', () => generation)
vi.mock('../review/flow-build', () => flow)
vi.mock('../git/worktree-inbox', () => inbox)
vi.mock('../fs/move-to-trash', () => trash)
vi.mock('../git/working-tree', () => workingTree)
vi.mock('../stores/reviewed-store', () => reviewed)

import { createGitRouter } from './git'

const gitRouter = createGitRouter()

const REQUEST_ID = '00000000-0000-4000-8000-000000000077'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const
const REPO = '/synthetic/repo'

function caller() {
  return gitRouter.createCaller(PUBLIC_CONTEXT)
}

/** Deliver raw untrusted input the typed caller cannot express — the wire's own entry point. */
async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router: gitRouter,
    path,
    type,
    ctx: PUBLIC_CONTEXT,
    getRawInput: async () => input,
    signal: undefined,
    batchIndex: 0,
  })
}

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

function expectPublicCode(error: unknown, code: string, unexpected: boolean) {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(unexpected)
  expect(publicErrorSchema.parse(normalized.error)).toMatchObject({ code, requestId: REQUEST_ID })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('git router contract input', () => {
  it('keeps the quick-command contract enum equal to the executable whitelist', async () => {
    const actual = await vi.importActual<typeof import('../git/git')>('../git/git')

    expect(procedureCatalog.gitQuickCommand.input.shape.command.options).toEqual(
      Object.keys(actual.QUICK_COMMANDS),
    )
  })

  it('runs a whitelisted quick command and clears the working-tree snapshot', async () => {
    expect(
      await caller().gitQuickCommand({ repoPath: REPO, command: 'pull', pullMode: 'rebase' }),
    ).toBe('On branch main')
    expect(git.gitQuickCommand).toHaveBeenCalledWith(REPO, 'pull', 'rebase')
    expect(workingTree.clearWorkingTreeSnapshot).toHaveBeenCalledWith(REPO)
  })

  it('rejects a quick command outside the whitelist without spawning Git', async () => {
    const error = await rejected(() =>
      callWithRawInput('gitQuickCommand', 'mutation', { repoPath: REPO, command: 'reset' }),
    )

    expectPublicCode(error, 'request.invalid', false)
    expect(git.gitQuickCommand).not.toHaveBeenCalled()
  })

  it('rejects an unknown staging key as request.invalid without staging', async () => {
    const error = await rejected(() =>
      callWithRawInput('gitStageFile', 'mutation', {
        repoPath: REPO,
        path: 'src/alpha.ts',
        force: true,
      }),
    )

    expectPublicCode(error, 'request.invalid', false)
    expect(git.gitStageFile).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only commit message and trims an accepted one', async () => {
    const error = await rejected(() =>
      callWithRawInput('gitCommit', 'mutation', { repoPath: REPO, message: '   ' }),
    )

    expectPublicCode(error, 'request.invalid', false)
    expect(git.gitCommit).not.toHaveBeenCalled()

    await callWithRawInput('gitCommit', 'mutation', { repoPath: REPO, message: '  feat: land  ' })
    expect(git.gitCommit).toHaveBeenCalledWith(REPO, 'feat: land')
    expect(reviewed.clearReviewedPaths).toHaveBeenCalledWith(REPO, ['src/alpha.ts'])
  })

  it('rejects an empty branch name for branch creation and worktree creation', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('gitCreateBranch', 'mutation', { repoPath: REPO, branch: '' }),
      ),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('gitAddWorktree', 'mutation', { repoPath: REPO, branch: '' }),
      ),
      'request.invalid',
      false,
    )
    expect(git.gitCreateBranch).not.toHaveBeenCalled()
    expect(git.gitAddWorktree).not.toHaveBeenCalled()
  })

  it('applies the gitLog and gitFileLog limit defaults and enforces their maximums', async () => {
    await callWithRawInput('gitLog', 'query', { repoPath: REPO })
    expect(git.gitLog).toHaveBeenCalledWith(REPO, 200)

    await callWithRawInput('gitFileLog', 'query', { repoPath: REPO, filePath: 'src/alpha.ts' })
    expect(git.gitFileLog).toHaveBeenCalledWith(REPO, 'src/alpha.ts', 50)

    expectPublicCode(
      await rejected(() => callWithRawInput('gitLog', 'query', { repoPath: REPO, limit: 501 })),
      'request.invalid',
      false,
    )
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('gitFileLog', 'query', {
          repoPath: REPO,
          filePath: 'src/alpha.ts',
          limit: 201,
        }),
      ),
      'request.invalid',
      false,
    )
    expect(git.gitLog).toHaveBeenCalledTimes(1)
    expect(git.gitFileLog).toHaveBeenCalledTimes(1)
  })

  it('rejects a non-string repo path on a bare-string query without spawning Git', async () => {
    const error = await rejected(() => callWithRawInput('gitStatus', 'query', { repoPath: REPO }))

    expectPublicCode(error, 'request.invalid', false)
    expect(git.gitStatus).not.toHaveBeenCalled()
  })
})

describe('git router contract output', () => {
  it('serializes representative Git reads against their output contracts', async () => {
    expect(await caller().gitStatus(REPO)).toEqual([
      { path: 'src/alpha.ts', status: 'modified', staged: true, unstaged: false },
    ])
    expect(await caller().gitSuggestions(REPO)).toEqual([
      { command: 'git pull', reason: 'behind upstream' },
    ])
    expect(await caller().gitHead(REPO)).toEqual({ branch: 'main', detachedSha: null })
    expect(await caller().gitBranches(REPO)).toEqual([{ name: 'main', remote: 'origin/main' }])
    expect(await caller().gitWorktrees(REPO)).toEqual([{ path: REPO, branch: 'main' }])
    expect(await caller().gitDiffFile({ repoPath: REPO, filePath: 'src/alpha.ts' })).toEqual({
      hunks: [],
      status: 'modified',
    })
    expect(await caller().gitFlow(REPO)).toEqual([
      { layer: 'source', files: [{ path: 'src/alpha.ts', status: 'modified', connects: [] }] },
    ])
    expect(await caller().gitRangeFlow(REPO)).toEqual({ groups: [], base: 'main' })
  })

  it('derives commit conventions from the log without a second contract', async () => {
    git.gitLog.mockResolvedValueOnce([
      { hash: 'abc1234', author: 'Agent', date: '2 days ago', subject: 'feat(git): add' },
    ])

    expect(await caller().gitCommitConventions(REPO)).toEqual({ types: ['feat'], scopes: ['git'] })
    expect(git.gitLog).toHaveBeenCalledWith(REPO, 200)
  })

  it('serializes generation results and the Review worktree inbox', async () => {
    expect(await caller().gitGenerateCommitMessage({ repoPath: REPO, model: 'claude' })).toEqual({
      message: 'feat(git): generated',
    })
    expect(await caller().gitGenerateCommitGroups({ repoPath: REPO, model: 'claude' })).toEqual({
      groups: [{ files: ['src/alpha.ts'], message: 'feat(git): group' }],
    })
    expect(await caller().worktreeInbox(REPO)).toEqual([
      { path: '/synthetic/repo-work', branch: 'work/alpha', changedCount: 3, hasReview: true },
    ])
  })

  it('serializes void staging mutations as undefined', async () => {
    expect(await caller().gitStageAll({ repoPath: REPO })).toBeUndefined()
    expect(await caller().gitUnstageAll({ repoPath: REPO })).toBeUndefined()
    expect(await caller().gitCheckout({ repoPath: REPO, branch: 'main' })).toBeUndefined()
    expect(git.gitStageAll).toHaveBeenCalledWith(REPO)
    expect(git.gitUnstageAll).toHaveBeenCalledWith(REPO)
  })

  it('refuses to serialize a status row whose file status violates the contract', async () => {
    git.gitStatus.mockResolvedValueOnce([{ path: 'src/alpha.ts', status: 'exploded' }] as never)

    expectPublicCode(await rejected(() => caller().gitStatus(REPO)), 'internal.unexpected', true)
  })

  it('refuses to serialize an inbox row with an unknown key', async () => {
    inbox.worktreeInbox.mockResolvedValueOnce([
      {
        path: '/synthetic/repo-work',
        branch: 'work/alpha',
        changedCount: 3,
        hasReview: true,
        stale: false,
      },
    ] as never)

    expectPublicCode(
      await rejected(() => caller().worktreeInbox(REPO)),
      'internal.unexpected',
      true,
    )
  })
})
