import type { Worktree } from '@porcelain/contracts/git'
import type { ReviewInboxRow } from '@porcelain/contracts/review'
import { useGitWorkspace } from '@renderer/features/git'
import { useNewWindow } from '@renderer/hooks/use-new-window'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorktreeSwitcher } from './worktree-switcher'

// The switcher hides its new-window control in the browser client (isBrowser);
// jsdom has no preload bridge, so isBrowser is true by default. This suite tests
// the Electron-shell UI, so pin isBrowser false.
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false, isE2E: false }))

// Components read through domain hooks, so mock the hook modules and never touch
// the tRPC proxy. Worktree is the real @main/diff type, so shape drift breaks here.
vi.mock('@renderer/hooks/use-new-window', () => ({ useNewWindow: vi.fn() }))
vi.mock('@renderer/features/git', () => ({
  useGitWorkspace: vi.fn(),
}))

const worktrees: Worktree[] = [
  { path: '/Users/me/code/app', branch: 'main' },
  { path: '/Users/me/code/app-feature', branch: 'feature' },
]

const openWindow = vi.fn()

function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: /Worktrees:/i }))
}

describe('WorktreeSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectSelectionStore.setState({
      project: { path: '/Users/me/code/app', name: 'app' },
      switchProject: vi.fn(),
    })
    vi.mocked(useGitWorkspace).mockReturnValue({
      branch: 'main',
      branches: [],
      head: undefined,
      inbox: [],
      refreshBranches: vi.fn().mockResolvedValue(undefined),
      worktrees,
    })
    vi.mocked(useNewWindow).mockReturnValue({ openWindow })
  })

  it('switches this window in place when a worktree row is clicked', async () => {
    render(<WorktreeSwitcher />)
    openMenu()

    fireEvent.click(await screen.findByRole('menuitem', { name: /feature/i }))

    expect(useProjectSelectionStore.getState().switchProject).toHaveBeenCalledWith(
      '/Users/me/code/app-feature',
    )
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('opens a worktree in a new window from the trailing button, without switching this one', async () => {
    render(<WorktreeSwitcher />)
    openMenu()

    // Two rows → two "Open in new window" buttons; the second is the feature worktree.
    const buttons = await screen.findAllByLabelText('Open in new window')
    const button = buttons[1]
    if (button === undefined) throw new Error('expected a second button')
    fireEvent.click(button)

    expect(openWindow).toHaveBeenCalledWith('/Users/me/code/app-feature')
    expect(useProjectSelectionStore.getState().switchProject).not.toHaveBeenCalled()
    // The controlled menu closes after the click (the button's stopPropagation
    // suppresses Base UI's row-level handling).
    expect(screen.queryByRole('menuitem', { name: /feature/i })).toBeNull()
  })

  it('badges the chip when other worktrees need review', () => {
    const inbox: ReviewInboxRow[] = [
      {
        path: '/Users/me/code/app-feature',
        branch: 'feature',
        changedCount: 3,
        hasReview: true,
      },
    ]
    vi.mocked(useGitWorkspace).mockReturnValue({
      branch: 'main',
      branches: [],
      head: undefined,
      inbox,
      refreshBranches: vi.fn().mockResolvedValue(undefined),
      worktrees,
    })
    render(<WorktreeSwitcher />)
    const chip = screen.getByRole('button', { name: /Worktrees:.*need review/i })
    expect(chip).toHaveAttribute('data-inbox-count', '1')
  })
})
