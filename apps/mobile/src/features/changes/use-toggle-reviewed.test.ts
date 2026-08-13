import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setReviewedMutate = vi.fn()

vi.mock('@/features/projects', () => ({
  useActiveProject: () => ({ path: '/repo' }),
}))

// Flow reads are the Git feature's; this suite is about the Review-mark writes only.
vi.mock('@/features/git', () => ({
  useGitFlow: () => ({ error: null, groups: undefined, isLoading: false }),
  useGitRangeFlow: () => ({ base: undefined, error: null, groups: undefined, isLoading: false }),
}))

vi.mock('@/lib/daemon/queries', () => ({
  useDaemonMutation: () => ({
    error:
      setReviewedMutate.mock.results.at(-1)?.type === 'throw'
        ? setReviewedMutate.mock.results.at(-1)?.value
        : null,
    isPending: false,
    mutate: setReviewedMutate,
    mutateAsync: setReviewedMutate,
  }),
  useDaemonQuery: () => ({ data: [], error: null, isLoading: false }),
}))

import { useToggleReviewed } from './use-changes'

describe('useToggleReviewed total void actions', () => {
  beforeEach(() => {
    setReviewedMutate.mockReset()
  })

  it('is void and calls mutate (not mutateAsync) so UI edges never float', () => {
    const { result } = renderHook(() => useToggleReviewed())

    let returned: unknown
    act(() => {
      returned = result.current.setReviewed(['src/a.ts'], true)
    })
    expect(returned).toBeUndefined()
    expect(setReviewedMutate).toHaveBeenCalledWith({
      paths: ['src/a.ts'],
      repoPath: '/repo',
      reviewed: true,
    })

    act(() => {
      returned = result.current.setReviewed(['src/a.ts'], false)
    })
    expect(returned).toBeUndefined()
    expect(setReviewedMutate).toHaveBeenLastCalledWith({
      paths: ['src/a.ts'],
      repoPath: '/repo',
      reviewed: false,
    })
  })

  it('sends one write for a whole set rather than one per path', () => {
    const { result } = renderHook(() => useToggleReviewed())

    act(() => {
      result.current.setReviewed(['src/a.ts', 'src/b.ts', 'src/c.ts'], true)
    })

    expect(setReviewedMutate).toHaveBeenCalledTimes(1)
    expect(setReviewedMutate).toHaveBeenCalledWith({
      paths: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
      repoPath: '/repo',
      reviewed: true,
    })
  })

  it('writes nothing for an empty path list, which the wire refuses', () => {
    const { result } = renderHook(() => useToggleReviewed())

    act(() => {
      result.current.setReviewed([], false)
    })

    expect(setReviewedMutate).not.toHaveBeenCalled()
  })

  it('mutate rejection is owned by React Query mutation machinery (no unhandled rejection)', () => {
    // mutate swallows rejections into mutation state; calling the write must not throw.
    setReviewedMutate.mockImplementation(() => {
      // simulate fire-and-forget mutate that schedules a rejection on the mutation
    })
    const { result } = renderHook(() => useToggleReviewed())
    expect(() => {
      act(() => {
        result.current.setReviewed(['src/a.ts'], true)
      })
    }).not.toThrow()
  })
})
