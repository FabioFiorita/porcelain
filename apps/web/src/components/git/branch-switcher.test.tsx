import { useGitCheckout, useGitCreateBranch, useGitWorkspace } from '@renderer/features/git'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BranchSwitcher } from './branch-switcher'

vi.mock('@renderer/features/git', () => ({
  useGitCheckout: vi.fn(),
  useGitCreateBranch: vi.fn(),
  useGitWorkspace: vi.fn(),
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

const project = { path: '/repo', name: 'repo' }
const refresh = vi.fn().mockResolvedValue(undefined)

describe('BranchSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectSelectionStore.setState({ project })
    vi.mocked(useGitWorkspace).mockReturnValue({
      branch: 'main',
      branches: [{ name: 'main', remote: null }],
      head: undefined,
      refreshBranches: refresh,
      worktrees: [],
    })
    vi.mocked(useGitCheckout).mockReturnValue({ isPending: false, mutateAsync: vi.fn() })
    vi.mocked(useGitCreateBranch).mockReturnValue({ isPending: false, mutateAsync: vi.fn() })
  })

  it('refreshes branch refs whenever the picker opens', () => {
    render(<BranchSwitcher />)

    fireEvent.click(screen.getByTestId(TestIds.branchSwitcher))

    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
