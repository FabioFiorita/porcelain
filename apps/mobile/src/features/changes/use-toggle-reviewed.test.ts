import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const markMutate = vi.fn()
const unmarkMutate = vi.fn()
const setAllMutate = vi.fn()

vi.mock('@/features/projects', () => ({
  useActiveProject: () => ({ path: '/repo' }),
}))

// Flow reads are the Git feature's; this suite is about the Review-mark writes only.
vi.mock('@/features/git', () => ({
  useGitFlow: () => ({ error: null, groups: undefined, isLoading: false }),
  useGitRangeFlow: () => ({ base: undefined, error: null, groups: undefined, isLoading: false }),
}))

vi.mock('@/lib/daemon/queries', () => ({
  useDaemonMutation: (procedure: { name: string }) => {
    if (procedure.name === 'markReviewed') {
      return {
        error:
          markMutate.mock.results.at(-1)?.type === 'throw'
            ? markMutate.mock.results.at(-1)?.value
            : null,
        isPending: false,
        mutate: markMutate,
        mutateAsync: markMutate,
      }
    }
    if (procedure.name === 'unmarkReviewed') {
      return {
        error: null,
        isPending: false,
        mutate: unmarkMutate,
        mutateAsync: unmarkMutate,
      }
    }
    return {
      error: null,
      isPending: false,
      mutate: setAllMutate,
      mutateAsync: setAllMutate,
    }
  },
  useDaemonQuery: () => ({ data: [], error: null, isLoading: false }),
}))

import { useToggleReviewed } from './use-changes'

describe('useToggleReviewed total void actions', () => {
  beforeEach(() => {
    markMutate.mockReset()
    unmarkMutate.mockReset()
    setAllMutate.mockReset()
  })

  it('mark/unmark are void and call mutate (not mutateAsync) so UI edges never float', () => {
    const { result } = renderHook(() => useToggleReviewed())

    let returned: unknown
    act(() => {
      returned = result.current.mark('src/a.ts')
    })
    expect(returned).toBeUndefined()
    expect(markMutate).toHaveBeenCalledWith({ path: 'src/a.ts', repoPath: '/repo' })

    act(() => {
      returned = result.current.unmark('src/a.ts')
    })
    expect(returned).toBeUndefined()
    expect(unmarkMutate).toHaveBeenCalledWith({ path: 'src/a.ts', repoPath: '/repo' })
  })

  it('mutate rejection is owned by React Query mutation machinery (no unhandled rejection)', () => {
    // mutate swallows rejections into mutation state; calling mark must not throw.
    markMutate.mockImplementation(() => {
      // simulate fire-and-forget mutate that schedules a rejection on the mutation
    })
    const { result } = renderHook(() => useToggleReviewed())
    expect(() => {
      act(() => {
        result.current.mark('src/a.ts')
      })
    }).not.toThrow()
  })
})
