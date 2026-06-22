import type { Worktree } from '@main/diff'
import { useNewWindow } from '@renderer/hooks/use-repo'
import { useWorktrees } from '@renderer/hooks/use-worktrees'
import { useRepoStore } from '@renderer/stores/repo'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorktreeSwitcher } from './worktree-switcher'

// Components read through domain hooks, so mock the hook modules and never touch
// the tRPC proxy. Worktree is the real @main/diff type, so shape drift breaks here.
vi.mock('@renderer/hooks/use-repo', () => ({ useNewWindow: vi.fn() }))
vi.mock('@renderer/hooks/use-worktrees', () => ({ useWorktrees: vi.fn() }))

const worktrees: Worktree[] = [
  { path: '/Users/me/code/app', branch: 'main' },
  { path: '/Users/me/code/app-feature', branch: 'feature' },
]

const openWindow = vi.fn()

function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: /worktree/i }))
}

describe('WorktreeSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRepoStore.setState({
      repo: { path: '/Users/me/code/app', name: 'app' },
      switchTo: vi.fn(),
    })
    vi.mocked(useWorktrees).mockReturnValue(worktrees)
    vi.mocked(useNewWindow).mockReturnValue({ openWindow })
  })

  it('switches this window in place when a worktree row is clicked', async () => {
    render(<WorktreeSwitcher />)
    openMenu()

    fireEvent.click(await screen.findByRole('menuitem', { name: /feature/i }))

    expect(useRepoStore.getState().switchTo).toHaveBeenCalledWith('/Users/me/code/app-feature')
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('opens a worktree in a new window from the trailing button, without switching this one', async () => {
    render(<WorktreeSwitcher />)
    openMenu()

    // Two rows → two "Open in new window" buttons; the second is the feature worktree.
    const buttons = await screen.findAllByLabelText('Open in new window')
    fireEvent.click(buttons[1])

    expect(openWindow).toHaveBeenCalledWith('/Users/me/code/app-feature')
    expect(useRepoStore.getState().switchTo).not.toHaveBeenCalled()
    // The controlled menu closes after the click (the button's stopPropagation
    // suppresses Base UI's row-level handling).
    expect(screen.queryByRole('menuitem', { name: /feature/i })).toBeNull()
  })
})
