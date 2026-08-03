import { useRepoStore } from '@renderer/stores/repo'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGitFlow, useGitSuggestions } from './use-git-flow'

const gitFlowQuery = vi.hoisted(() => vi.fn())
const gitSuggestionsQuery = vi.hoisted(() => vi.fn())
const useUtils = vi.hoisted(() => vi.fn())

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    gitFlow: { useQuery: gitFlowQuery },
    gitSuggestions: { useQuery: gitSuggestionsQuery },
    useUtils,
  },
}))

const aRepo = { path: '/repo', name: 'repo' }

beforeEach(() => {
  vi.clearAllMocks()
  useRepoStore.setState({ repo: null })
  gitFlowQuery.mockReturnValue({ data: undefined, refetch: vi.fn() })
  gitSuggestionsQuery.mockReturnValue({ data: undefined })
  useUtils.mockReturnValue({ gitDiffFile: { invalidate: vi.fn() } })
})

describe('useGitFlow', () => {
  it('disables the query and returns undefined groups with no repo selected', () => {
    const { result } = renderHook(() => useGitFlow())
    expect(gitFlowQuery).toHaveBeenCalledWith('', expect.objectContaining({ enabled: false }))
    expect(result.current.groups).toBeUndefined()
  })

  it('passes through the flow groups', () => {
    useRepoStore.setState({ repo: aRepo })
    const groups = [{ layer: 'ui', files: [] }]
    gitFlowQuery.mockReturnValue({ data: groups, refetch: vi.fn() })
    const { result } = renderHook(() => useGitFlow())
    expect(gitFlowQuery).toHaveBeenCalledWith(
      aRepo.path,
      expect.objectContaining({ enabled: true }),
    )
    expect(result.current.groups).toBe(groups)
  })

  it('refresh() refetches the flow AND invalidates every mounted diff', async () => {
    useRepoStore.setState({ repo: aRepo })
    const refetch = vi.fn().mockResolvedValue(undefined)
    gitFlowQuery.mockReturnValue({ data: [], refetch })
    const invalidate = vi.fn().mockResolvedValue(undefined)
    useUtils.mockReturnValue({ gitDiffFile: { invalidate } })

    const { result } = renderHook(() => useGitFlow())
    await result.current.refresh()

    expect(refetch).toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalled()
  })
})

describe('useGitSuggestions', () => {
  it('returns [] with no repo selected', () => {
    const { result } = renderHook(() => useGitSuggestions())
    expect(gitSuggestionsQuery).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ enabled: false }),
    )
    expect(result.current).toEqual([])
  })

  it('passes through the suggestion list', () => {
    useRepoStore.setState({ repo: aRepo })
    const suggestions = [{ command: 'stash', reason: '3 files changed' }]
    gitSuggestionsQuery.mockReturnValue({ data: suggestions })
    const { result } = renderHook(() => useGitSuggestions())
    expect(result.current).toBe(suggestions)
  })
})
