// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import type { GitOperations } from './git-operations'
import type { GitWorkspaceError } from './git-ports'
import { createGitFeatureRouter } from './git-router'

const REQUEST_ID = '00000000-0000-4000-8000-0000000000b1'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' as const }, requestId: REQUEST_ID }
const CHECKOUT_INPUT = { repoPath: '/synthetic/repo', branch: 'main' }
const WORKTREE_INPUT = { repoPath: '/synthetic/repo', branch: 'feature/x' }

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

function operations(overrides: Partial<GitOperations> = {}): GitOperations {
  return {
    checkoutGit: vi.fn(async () => ({ ok: true, value: undefined })),
    addGitWorktree: vi.fn(async () => ({
      ok: true,
      value: { path: '/synthetic/repo-worktrees/feature-x', branch: 'feature/x' },
    })),
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
    const router = createGitFeatureRouter({ checkoutGit, addGitWorktree })
    const caller = router.createCaller(PUBLIC_CONTEXT)

    await expect(caller.gitCheckout(CHECKOUT_INPUT)).resolves.toBeUndefined()
    await expect(caller.gitAddWorktree(WORKTREE_INPUT)).resolves.toEqual({
      path: '/synthetic/repo-worktrees/feature-x',
      branch: 'feature/x',
    })
    expect(checkoutGit).toHaveBeenCalledTimes(1)
    expect(checkoutGit).toHaveBeenCalledWith(CHECKOUT_INPUT)
    expect(addGitWorktree).toHaveBeenCalledTimes(1)
    expect(addGitWorktree).toHaveBeenCalledWith(WORKTREE_INPUT)
  })

  it('maps every declared Git capability failure to its public error', async () => {
    const checkoutErrors = [
      { code: 'git.not-a-repository' },
      { code: 'git.branch-not-found' },
      { code: 'git.working-tree-conflict' },
    ] satisfies GitWorkspaceError[]
    const addWorktreeErrors = [
      { code: 'git.not-a-repository' },
      { code: 'git.branch-already-exists' },
      { code: 'git.worktree-conflict' },
    ] satisfies GitWorkspaceError[]

    for (const error of checkoutErrors) {
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
    for (const error of addWorktreeErrors) {
      const router = createGitFeatureRouter(
        operations({
          addGitWorktree: async () => ({ ok: false, error }),
        }),
      )
      expectPublicCode(
        await rejected(() => router.createCaller(PUBLIC_CONTEXT).gitAddWorktree(WORKTREE_INPUT)),
        error.code,
      )
    }
  })

  it('rejects invalid raw input before invoking an operation', async () => {
    const checkoutGit = vi.fn(async () => ({ ok: true, value: undefined }))
    const router = createGitFeatureRouter(
      operations({
        checkoutGit,
      }),
    )
    const error = await rejected(() =>
      callTRPCProcedure({
        router,
        path: 'gitAddWorktree',
        type: 'mutation',
        ctx: PUBLIC_CONTEXT,
        getRawInput: async () => ({ repoPath: '/synthetic/repo', branch: '' }),
        signal: undefined,
        batchIndex: 0,
      }),
    )

    expectPublicCode(error, 'request.invalid')
    expect(checkoutGit).not.toHaveBeenCalled()
  })

  it('lets unexpected operation errors reach the centralized internal mapping', async () => {
    const router = createGitFeatureRouter(
      operations({
        checkoutGit: async () => {
          throw new Error('secret native path /home/user/private')
        },
      }),
    )
    const error = await rejected(() =>
      router.createCaller(PUBLIC_CONTEXT).gitCheckout(CHECKOUT_INPUT),
    )

    expectPublicCode(error, 'internal.unexpected', true)
    expect(JSON.stringify(normalizePublicError(error, REQUEST_ID).error)).not.toContain(
      '/home/user/private',
    )
  })
})
