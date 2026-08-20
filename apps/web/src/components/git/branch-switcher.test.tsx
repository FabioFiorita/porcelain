import { useGitCheckout, useGitCreateBranch, useGitWorkspace } from '@renderer/features/git'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BranchSwitcher, SwitchBranchDialog } from './branch-switcher'

vi.mock('@renderer/features/git', () => ({
  useGitCheckout: vi.fn(),
  useGitCreateBranch: vi.fn(),
  useGitWorkspace: vi.fn(),
}))

// cmdk calls scrollIntoView on the selected item; jsdom doesn't ship it (the
// ResizeObserver it also needs is stubbed once, in the shared test setup).
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

  it('checks out the chosen branch in the worktree path the dialog was opened with', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useGitCheckout).mockReturnValue({ isPending: false, mutateAsync })
    vi.mocked(useGitWorkspace).mockReturnValue({
      branch: 'main',
      branches: [
        { name: 'main', remote: null },
        { name: 'topic', remote: null },
      ],
      head: undefined,
      refreshBranches: refresh,
      worktrees: [],
    })
    render(
      <SwitchBranchDialog
        open
        currentBranch="main"
        repoPath="/repo-worktrees/topic"
        onOpenChange={vi.fn()}
      />,
    )
    fireEvent.click(await screen.findByRole('option', { name: 'topic' }))
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('topic', '/repo-worktrees/topic')
    })
  })
})
