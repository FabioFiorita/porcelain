// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../daemon-composition/public-error'

const { git, flow, inbox } = vi.hoisted(() => ({
  git: {
    gitRangeDiffFile: vi.fn(async () => ({ hunks: [], status: 'modified' })),
    gitDiffFile: vi.fn(async () => ({ hunks: [], status: 'modified' })),
    gitLog: vi.fn(async () => [
      { hash: 'abc1234', author: 'Agent', date: '2 days ago', subject: 'feat(git): add' },
    ]),
    gitCommitMessage: vi.fn(async () => 'feat(git): add\n\nbody'),
    gitFileLog: vi.fn(async () => [
      { hash: 'abc1234', author: 'Agent', date: '2 days ago', subject: 'feat(git): add' },
    ]),
    gitCommitDiff: vi.fn(async () => [{ header: '@@ -1 +1 @@', lines: [] }]),
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
}))

vi.mock('../git/git', () => git)
vi.mock('../review/flow-build', () => flow)
vi.mock('../git/worktree-inbox', () => inbox)

import { createGitRouter } from './git'

const gitRouter = createGitRouter()
const REQUEST_ID = '00000000-0000-4000-8000-000000000077'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const
const REPO = '/synthetic/repo'

function caller() {
  return gitRouter.createCaller(PUBLIC_CONTEXT)
}

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

function expectPublicCode(error: unknown, code: string): void {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(code === 'internal.unexpected')
  expect(publicErrorSchema.parse(normalized.error)).toMatchObject({ code, requestId: REQUEST_ID })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('residual Git router contract input', () => {
  it('applies history limit defaults and enforces their maximums', async () => {
    await callWithRawInput('gitLog', 'query', { repoPath: REPO })
    expect(git.gitLog).toHaveBeenCalledWith(REPO, 200)

    await callWithRawInput('gitFileLog', 'query', { repoPath: REPO, filePath: 'src/alpha.ts' })
    expect(git.gitFileLog).toHaveBeenCalledWith(REPO, 'src/alpha.ts', 50)

    expectPublicCode(
      await rejected(() => callWithRawInput('gitLog', 'query', { repoPath: REPO, limit: 501 })),
      'request.invalid',
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
    )
    expect(git.gitLog).toHaveBeenCalledTimes(1)
    expect(git.gitFileLog).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed residual input before calling a helper', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('gitDiffFile', 'query', { repoPath: REPO, filePath: 42 }),
      ),
      'request.invalid',
    )
    expect(git.gitDiffFile).not.toHaveBeenCalled()
  })
})

describe('residual Git router contract output', () => {
  it('serializes flow, diff, history, and Review Inbox outputs', async () => {
    expect(await caller().gitFlow(REPO)).toEqual([
      { layer: 'source', files: [{ path: 'src/alpha.ts', status: 'modified', connects: [] }] },
    ])
    expect(await caller().gitRangeFlow(REPO)).toEqual({ groups: [], base: 'main' })
    expect(await caller().gitDiffFile({ repoPath: REPO, filePath: 'src/alpha.ts' })).toEqual({
      hunks: [],
      status: 'modified',
    })
    expect(
      await caller().gitRangeDiffFile({
        repoPath: REPO,
        base: 'main',
        filePath: 'src/alpha.ts',
      }),
    ).toEqual({ hunks: [], status: 'modified' })
    expect(await caller().gitLog({ repoPath: REPO, limit: 20 })).toEqual([
      { hash: 'abc1234', author: 'Agent', date: '2 days ago', subject: 'feat(git): add' },
    ])
    expect(await caller().gitCommitMessage({ repoPath: REPO, hash: 'abc1234' })).toBe(
      'feat(git): add\n\nbody',
    )
    expect(
      await caller().gitFileLog({ repoPath: REPO, filePath: 'src/alpha.ts', limit: 20 }),
    ).toEqual([{ hash: 'abc1234', author: 'Agent', date: '2 days ago', subject: 'feat(git): add' }])
    expect(
      await caller().gitCommitDiff({ repoPath: REPO, hash: 'abc1234', filePath: 'src/alpha.ts' }),
    ).toEqual([{ header: '@@ -1 +1 @@', lines: [] }])
    expect(await caller().gitCommitFlow({ repoPath: REPO, hash: 'abc1234' })).toEqual([])
    expect(await caller().worktreeInbox(REPO)).toEqual([
      { path: '/synthetic/repo-work', branch: 'work/alpha', changedCount: 3, hasReview: true },
    ])
  })

  it('refuses to serialize a residual diff row whose status violates its contract', async () => {
    git.gitDiffFile.mockResolvedValueOnce([{ hunks: [], status: 'exploded' }] as never)
    expectPublicCode(
      await rejected(() => caller().gitDiffFile({ repoPath: REPO, filePath: 'src/alpha.ts' })),
      'internal.unexpected',
    )
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

    expectPublicCode(await rejected(() => caller().worktreeInbox(REPO)), 'internal.unexpected')
  })
})
