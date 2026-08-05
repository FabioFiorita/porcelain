import { useRepoStore } from '@renderer/stores/repo'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useBranch,
  useBranches,
  useCheckout,
  useCreateBranch,
  useWorktreeInbox,
  useWorktrees,
} from './use-worktrees'

const gitHeadQuery = vi.hoisted(() => vi.fn())
const gitWorktreesQuery = vi.hoisted(() => vi.fn())
const worktreeInboxQuery = vi.hoisted(() => vi.fn())
const gitBranchesQuery = vi.hoisted(() => vi.fn())
const gitCheckoutMutation = vi.hoisted(() => vi.fn())
const gitCreateBranchMutation = vi.hoisted(() => vi.fn())
const useUtils = vi.hoisted(() => vi.fn())

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    gitHead: { useQuery: gitHeadQuery },
    gitWorktrees: { useQuery: gitWorktreesQuery },
    worktreeInbox: { useQuery: worktreeInboxQuery },
    gitBranches: { useQuery: gitBranchesQuery },
    gitCheckout: { useMutation: gitCheckoutMutation },
    gitCreateBranch: { useMutation: gitCreateBranchMutation },
    useUtils,
  },
}))

const aRepo = { path: '/repo', name: 'repo' }

beforeEach(() => {
  vi.clearAllMocks()
  useRepoStore.setState({ repo: null })
  gitHeadQuery.mockReturnValue({ data: undefined })
  gitWorktreesQuery.mockReturnValue({ data: undefined })
  worktreeInboxQuery.mockReturnValue({ data: undefined })
  gitBranchesQuery.mockReturnValue({ data: undefined, refetch: vi.fn() })
  useUtils.mockReturnValue({ invalidate: vi.fn() })
})

describe('useBranch', () => {
  it('disables the query and returns undefined with no repo selected', () => {
    const { result } = renderHook(() => useBranch())
    expect(gitHeadQuery).toHaveBeenCalledWith('', expect.objectContaining({ enabled: false }))
    expect(result.current).toBeUndefined()
  })

  it('renders the checked-out branch name', () => {
    useRepoStore.setState({ repo: aRepo })
    gitHeadQuery.mockReturnValue({ data: { branch: 'main', detachedSha: null } })
    const { result } = renderHook(() => useBranch())
    expect(gitHeadQuery).toHaveBeenCalledWith(
      aRepo.path,
      expect.objectContaining({ enabled: true }),
    )
    expect(result.current).toBe('main')
  })

  it('renders a detached HEAD as "detached @ <sha>"', () => {
    useRepoStore.setState({ repo: aRepo })
    gitHeadQuery.mockReturnValue({ data: { branch: null, detachedSha: 'abc1234' } })
    const { result } = renderHook(() => useBranch())
    expect(result.current).toBe('detached @ abc1234')
  })
})

describe('useWorktrees', () => {
  it('returns [] with no repo selected, without throwing', () => {
    const { result } = renderHook(() => useWorktrees())
    expect(gitWorktreesQuery).toHaveBeenCalledWith('', expect.objectContaining({ enabled: false }))
    expect(result.current).toEqual([])
  })

  it('passes through the worktree list', () => {
    useRepoStore.setState({ repo: aRepo })
    const worktrees = [{ path: '/repo', branch: 'main' }]
    gitWorktreesQuery.mockReturnValue({ data: worktrees })
    const { result } = renderHook(() => useWorktrees())
    expect(gitWorktreesQuery).toHaveBeenCalledWith(
      aRepo.path,
      expect.objectContaining({ enabled: true }),
    )
    expect(result.current).toBe(worktrees)
  })
})

describe('useWorktreeInbox', () => {
  it('returns [] with no repo selected', () => {
    const { result } = renderHook(() => useWorktreeInbox())
    expect(worktreeInboxQuery).toHaveBeenCalledWith('', expect.objectContaining({ enabled: false }))
    expect(result.current).toEqual([])
  })

  it('passes through the inbox rows', () => {
    useRepoStore.setState({ repo: aRepo })
    const rows = [{ path: '/sibling', branch: 'feature', changedCount: 2, hasReview: true }]
    worktreeInboxQuery.mockReturnValue({ data: rows })
    const { result } = renderHook(() => useWorktreeInbox())
    expect(result.current).toBe(rows)
  })
})

describe('useBranches', () => {
  it('returns [] with no repo selected', () => {
    const { result } = renderHook(() => useBranches())
    expect(gitBranchesQuery).toHaveBeenCalledWith('', expect.objectContaining({ enabled: false }))
    expect(result.current.branches).toEqual([])
  })

  it('passes through the branch list', () => {
    useRepoStore.setState({ repo: aRepo })
    const branches = [{ name: 'main', remote: null }]
    gitBranchesQuery.mockReturnValue({ data: branches, refetch: vi.fn() })
    const { result } = renderHook(() => useBranches())
    expect(gitBranchesQuery).toHaveBeenCalledWith(
      aRepo.path,
      expect.objectContaining({ enabled: true, staleTime: 0 }),
    )
    expect(result.current.branches).toBe(branches)
  })

  it('refreshes the live branch refs on demand', async () => {
    useRepoStore.setState({ repo: aRepo })
    const refetch = vi.fn().mockResolvedValue(undefined)
    gitBranchesQuery.mockReturnValue({ data: [], refetch })

    const { result } = renderHook(() => useBranches())
    await result.current.refresh()

    expect(refetch).toHaveBeenCalled()
  })
})

describe('useCheckout', () => {
  it('does nothing with no repo selected', async () => {
    const mutateAsync = vi.fn()
    gitCheckoutMutation.mockReturnValue({ mutateAsync })
    const invalidate = vi.fn()
    useUtils.mockReturnValue({ invalidate })

    const { result } = renderHook(() => useCheckout())
    await result.current('feature')

    expect(mutateAsync).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('checks out the branch then invalidates every mounted query', async () => {
    useRepoStore.setState({ repo: aRepo })
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    gitCheckoutMutation.mockReturnValue({ mutateAsync })
    const invalidate = vi.fn()
    useUtils.mockReturnValue({ invalidate })

    const { result } = renderHook(() => useCheckout())
    await result.current('feature')

    expect(mutateAsync).toHaveBeenCalledWith({ repoPath: aRepo.path, branch: 'feature' })
    expect(invalidate).toHaveBeenCalled()
  })

  it('still invalidates when the checkout rejects, then rethrows', async () => {
    useRepoStore.setState({ repo: aRepo })
    const failure = new Error('dirty working tree')
    const mutateAsync = vi.fn().mockRejectedValue(failure)
    gitCheckoutMutation.mockReturnValue({ mutateAsync })
    const invalidate = vi.fn()
    useUtils.mockReturnValue({ invalidate })

    const { result } = renderHook(() => useCheckout())

    await expect(result.current('feature')).rejects.toThrow(failure)
    expect(invalidate).toHaveBeenCalled()
  })
})

describe('useCreateBranch', () => {
  it('does nothing with no repo selected', async () => {
    const mutateAsync = vi.fn()
    gitCreateBranchMutation.mockReturnValue({ mutateAsync })
    const invalidate = vi.fn()
    useUtils.mockReturnValue({ invalidate })

    const { result } = renderHook(() => useCreateBranch())
    await result.current('feature')

    expect(mutateAsync).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('creates the branch then invalidates every mounted query', async () => {
    useRepoStore.setState({ repo: aRepo })
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    gitCreateBranchMutation.mockReturnValue({ mutateAsync })
    const invalidate = vi.fn()
    useUtils.mockReturnValue({ invalidate })

    const { result } = renderHook(() => useCreateBranch())
    await result.current('feature')

    expect(mutateAsync).toHaveBeenCalledWith({ repoPath: aRepo.path, branch: 'feature' })
    expect(invalidate).toHaveBeenCalled()
  })
})
