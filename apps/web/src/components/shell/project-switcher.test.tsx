import type { ProjectInfo } from '@porcelain/contracts/projects'
import {
  useOpenProject,
  useRecentProjects,
  useRemoveRecentProject,
  useSelectedProject,
} from '@renderer/features/projects'
import { useNewWindow } from '@renderer/hooks/use-new-window'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectSwitcher } from './project-switcher'

// The switcher hides its new-window controls in the browser client (isBrowser);
// under jsdom there's no preload bridge, so isBrowser is true by default. These
// tests exercise the Electron-shell UI, so pin isBrowser false.
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false, isE2E: false }))

// The convention: components read through domain hooks, so mock the hook module
// and never touch the tRPC proxy. ProjectSummary is the real @main/api type, so drift
// in the recents shape breaks the build here.
vi.mock('@renderer/hooks/use-new-window', () => ({
  useNewWindow: vi.fn(),
}))

vi.mock('@renderer/features/projects', () => ({
  useOpenProject: vi.fn(),
  useRecentProjects: vi.fn(),
  useRemoveRecentProject: vi.fn(),
  useSelectedProject: vi.fn(),
}))

const recents: ProjectInfo[] = [
  { path: '/Users/me/code/alpha', name: 'alpha' },
  { path: '/Users/me/code/beta', name: 'beta' },
]

const openWindow = vi.fn()
const openProject = vi.fn()
const remove = vi.fn()

function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Switch project' }))
}

describe('ProjectSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectSelectionStore.setState({
      project: { path: '/Users/me/code/alpha', name: 'alpha' },
      switchProject: vi.fn(),
      openProjectPicker: vi.fn(),
    })
    vi.mocked(useSelectedProject).mockReturnValue(recents[0] ?? null)
    vi.mocked(useRecentProjects).mockReturnValue(recents)
    vi.mocked(useOpenProject).mockReturnValue({ open: openProject, isPending: false })
    vi.mocked(useNewWindow).mockReturnValue({ openWindow })
    vi.mocked(useRemoveRecentProject).mockReturnValue({ remove, isPending: false })
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
    const button = buttons[0]
    if (button === undefined) throw new Error('expected a button')
    fireEvent.click(button)

    const alpha = recents[0]
    if (alpha === undefined) throw new Error('expected recents[0]')
    expect(openWindow).toHaveBeenCalledWith(alpha.path)
    expect(openProject).not.toHaveBeenCalled()
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

    const removeButton = removeButtons[0]
    if (removeButton === undefined) throw new Error('expected a remove button')
    fireEvent.click(removeButton)

    const beta = recents[1]
    if (beta === undefined) throw new Error('expected recents[1]')
    expect(remove).toHaveBeenCalledWith(beta.path)
    expect(openProject).not.toHaveBeenCalled()
    // The menu stays open so several projects can be pruned in a row.
    expect(screen.queryByRole('menuitem', { name: /new window/i })).not.toBeNull()
  })
})
