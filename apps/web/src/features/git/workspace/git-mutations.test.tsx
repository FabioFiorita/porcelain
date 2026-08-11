import { gitContractFixtures } from '@porcelain/contracts/git'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness, deferred } from '@renderer/hooks/trpc-test-harness'
import { useRepoStore } from '@renderer/stores/repo'
import { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGitAddWorktree, useGitCheckout, useGitCreateBranch } from './git-mutations'

const REPO = gitContractFixtures.gitCheckout.input.repoPath
const DAEMON_INFO = remoteContractFixtures.daemonInfo.output

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: DAEMON_INFO }),
}

beforeEach(() => {
  useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Web Git workspace mutations', () => {
  it('sends checkout input and applies its exact fourteen consequences after success', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitCheckout: () => ({ ok: true, value: gitContractFixtures.gitCheckout.output }),
    })
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { result } = renderHook(() => useGitCheckout(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('topic/synthetic')
    })

    expect(mock.requests()).toContainEqual({
      procedure: 'gitCheckout',
      kind: 'mutation',
      input: { branch: 'topic/synthetic', repoPath: REPO },
    })
    expect(invalidate).toHaveBeenCalledTimes(28)
  })

  it('keeps add-worktree consequences narrower than checkout', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitAddWorktree: () => ({ ok: true, value: gitContractFixtures.gitAddWorktree.output }),
    })
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { result } = renderHook(() => useGitAddWorktree(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('topic/synthetic')
    })

    expect(invalidate).toHaveBeenCalledTimes(6)
  })

  it('does not invalidate while pending and does not invalidate after refusal', async () => {
    const write = deferred<
      | { ok: true; value: undefined }
      | {
          ok: false
          error: {
            code: 'git.working-tree-conflict'
            category: 'conflict'
            message: string
            retryable: false
            requestId: string
          }
        }
    >()
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      gitCreateBranch: async () => write.promise,
    })
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { result } = renderHook(() => useGitCreateBranch(), { wrapper })

    let pending!: Promise<unknown>
    act(() => {
      pending = result.current.mutateAsync('topic/synthetic')
    })
    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(invalidate).not.toHaveBeenCalled()

    write.resolve({
      ok: false,
      error: {
        category: 'conflict',
        code: 'git.working-tree-conflict',
        message: 'dirty working tree',
        requestId: '00000000-0000-4000-8000-000000000099',
        retryable: false,
      },
    })
    await expect(pending).rejects.toThrow('dirty working tree')
    expect(invalidate).not.toHaveBeenCalled()
  })
})
