import type { RepoInfo } from '@backend/api'
import { useNewWindow, useRecentRepos, useRemoveRecentRepo } from '@renderer/hooks/use-repo'
import { useRepoStore } from '@renderer/stores/repo'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectSwitcher } from './project-switcher'

// The switcher hides its new-window controls in the browser client (isBrowser);
// under jsdom there's no preload bridge, so isBrowser is true by default. These
// tests exercise the Electron-shell UI, so pin isBrowser false.
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false }))

// The convention: components read through domain hooks, so mock the hook module
// and never touch the tRPC proxy. RepoInfo is the real @main/api type, so drift
// in the recents shape breaks the build here.
vi.mock('@renderer/hooks/use-repo', () => ({
  useRecentRepos: vi.fn(),
  useNewWindow: vi.fn(),
  useRemoveRecentRepo: vi.fn(),
}))

const recents: RepoInfo[] = [
  { path: '/Users/me/code/alpha', name: 'alpha' },
  { path: '/Users/me/code/beta', name: 'beta' },
]

const openWindow = vi.fn()
const remove = vi.fn()

function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Switch project' }))
}

describe('ProjectSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRepoStore.setState({
      repo: { path: '/Users/me/code/alpha', name: 'alpha' },
      switchTo: vi.fn(),
      openRepo: vi.fn(),
    })
    vi.mocked(useRecentRepos).mockReturnValue(recents)
    vi.mocked(useNewWindow).mockReturnValue({ openWindow })
    vi.mocked(useRemoveRecentRepo).mockReturnValue({ remove })
  })

  it('opens a fresh welcome window when "New window" is clicked', async () => {
    render(<ProjectSwitcher />)
    openMenu()

    fireEvent.click(await screen.findByRole('menuitem', { name: /new window/i }))
    expect(openWindow).toHaveBeenCalledWith()
  })

  it('opens a recent in a new window without switching this one', async () => {
    render(<ProjectSwitcher />)
    openMenu()

    const buttons = await screen.findAllByLabelText('Open in new window')
    fireEvent.click(buttons[0])

    expect(openWindow).toHaveBeenCalledWith(recents[0].path)
    expect(useRepoStore.getState().switchTo).not.toHaveBeenCalled()
    // The controlled open state closes the menu after the click (the button's
    // stopPropagation used to suppress Base UI's auto-close).
    expect(screen.queryByRole('menuitem', { name: /new window/i })).toBeNull()
  })

  it('removes a recent without switching or closing the menu, and never offers it for the open repo', async () => {
    render(<ProjectSwitcher />)
    openMenu()

    // alpha is the open repo (shows the check) — only beta can be pruned.
    const removeButtons = await screen.findAllByLabelText('Remove from projects')
    expect(removeButtons).toHaveLength(1)

    fireEvent.click(removeButtons[0])

    expect(remove).toHaveBeenCalledWith(recents[1].path)
    expect(useRepoStore.getState().switchTo).not.toHaveBeenCalled()
    // The menu stays open so several projects can be pruned in a row.
    expect(screen.queryByRole('menuitem', { name: /new window/i })).not.toBeNull()
  })
})
