import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNewWindow, useRecentRepos, useRemoveRecentRepo } from './use-repo'

const recentReposQuery = vi.hoisted(() => vi.fn())
const removeRecentRepoMutation = vi.hoisted(() => vi.fn())
const newWindowMutation = vi.hoisted(() => vi.fn())
const useUtils = vi.hoisted(() => vi.fn())

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    recentRepos: { useQuery: recentReposQuery },
    removeRecentRepo: { useMutation: removeRecentRepoMutation },
    useUtils,
  },
  shellTrpc: {
    newWindow: { useMutation: newWindowMutation },
  },
}))

const aRepo = { path: '/repo', name: 'repo' }

beforeEach(() => {
  vi.clearAllMocks()
  recentReposQuery.mockReturnValue({ data: undefined })
  useUtils.mockReturnValue({ recentRepos: { invalidate: vi.fn() } })
})

describe('useRecentRepos', () => {
  it('returns [] with no data yet', () => {
    const { result } = renderHook(() => useRecentRepos())
    expect(recentReposQuery).toHaveBeenCalledWith(undefined, { enabled: true })
    expect(result.current).toEqual([])
  })

  it('passes through the recent repo list', () => {
    const repos = [aRepo]
    recentReposQuery.mockReturnValue({ data: repos })
    const { result } = renderHook(() => useRecentRepos())
    expect(result.current).toBe(repos)
  })

  it('forwards the enabled gate to the query', () => {
    renderHook(() => useRecentRepos(false))
    expect(recentReposQuery).toHaveBeenCalledWith(undefined, { enabled: false })
  })
})

describe('useRemoveRecentRepo', () => {
  it('mutates with the given repo path', () => {
    const mutate = vi.fn()
    removeRecentRepoMutation.mockReturnValue({ mutate })
    const { result } = renderHook(() => useRemoveRecentRepo())

    result.current.remove('/old-repo')

    expect(mutate).toHaveBeenCalledWith('/old-repo')
  })

  it('invalidates recentRepos on success', async () => {
    const invalidate = vi.fn().mockResolvedValue(undefined)
    useUtils.mockReturnValue({ recentRepos: { invalidate } })
    removeRecentRepoMutation.mockImplementation((options: { onSuccess: () => Promise<void> }) => ({
      mutate: async () => {
        await options.onSuccess()
      },
    }))
    const { result } = renderHook(() => useRemoveRecentRepo())

    await result.current.remove('/old-repo')

    expect(invalidate).toHaveBeenCalled()
  })
})

describe('useNewWindow', () => {
  it('opens the welcome screen when called with no path', () => {
    const mutate = vi.fn()
    newWindowMutation.mockReturnValue({ mutate })
    const { result } = renderHook(() => useNewWindow())

    result.current.openWindow()

    expect(mutate).toHaveBeenCalledWith(undefined)
  })

  it('opens the given repo in a new window', () => {
    const mutate = vi.fn()
    newWindowMutation.mockReturnValue({ mutate })
    const { result } = renderHook(() => useNewWindow())

    result.current.openWindow('/repo')

    expect(mutate).toHaveBeenCalledWith({ repoPath: '/repo' })
  })
})
