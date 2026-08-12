import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNewWindow } from './use-repo'

const newWindowMutation = vi.hoisted(() => vi.fn())

vi.mock('@renderer/lib/trpc', () => ({
  shellTrpc: {
    newWindow: { useMutation: newWindowMutation },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
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
