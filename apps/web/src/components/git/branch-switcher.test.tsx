import { useBranch, useBranches, useCheckout, useCreateBranch } from '@renderer/hooks/use-worktrees'
import { useRepoStore } from '@renderer/stores/repo'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BranchSwitcher } from './branch-switcher'

vi.mock('@renderer/hooks/use-worktrees', () => ({
  useBranch: vi.fn(),
  useBranches: vi.fn(),
  useCheckout: vi.fn(),
  useCreateBranch: vi.fn(),
}))

// cmdk uses ResizeObserver and scrollIntoView internally; jsdom doesn't ship them.
if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = (): void => {}
}

const repo = { path: '/repo', name: 'repo' }
const refresh = vi.fn().mockResolvedValue(undefined)

describe('BranchSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRepoStore.setState({ repo })
    vi.mocked(useBranch).mockReturnValue('main')
    vi.mocked(useBranches).mockReturnValue({
      branches: [{ name: 'main', remote: null }],
      refresh,
    })
    vi.mocked(useCheckout).mockReturnValue(vi.fn())
    vi.mocked(useCreateBranch).mockReturnValue(vi.fn())
  })

  it('refreshes branch refs whenever the picker opens', () => {
    render(<BranchSwitcher />)

    fireEvent.click(screen.getByTestId(TestIds.branchSwitcher))

    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
