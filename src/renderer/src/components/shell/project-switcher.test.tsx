import type { RepoInfo } from '@main/api'
import { useNewWindow, useRecentRepos } from '@renderer/hooks/use-repo'
import { useRepoStore } from '@renderer/stores/repo'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectSwitcher } from './project-switcher'

// The convention: components read through domain hooks, so mock the hook module
// and never touch the tRPC proxy. RepoInfo is the real @main/api type, so drift
// in the recents shape breaks the build here.
vi.mock('@renderer/hooks/use-repo', () => ({
  useRecentRepos: vi.fn(),
  useNewWindow: vi.fn(),
}))

const recents: RepoInfo[] = [
  { path: '/Users/me/code/alpha', name: 'alpha' },
  { path: '/Users/me/code/beta', name: 'beta' },
]

const openWindow = vi.fn()

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
  })
})
