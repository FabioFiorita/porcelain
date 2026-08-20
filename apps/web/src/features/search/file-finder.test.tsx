import { useFileFinderStore } from '@renderer/stores/file-finder'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileFinder } from './file-finder'

vi.mock('./search-queries', () => ({
  useFileSearch: vi.fn(() => ({ results: [], isFetching: false })),
}))

vi.mock('@renderer/features/actions', () => ({
  useActionRun: vi.fn(() => vi.fn()),
  useActionRunStore: (selector: (state: { requestLocalRun: () => void }) => unknown) =>
    selector({ requestLocalRun: vi.fn() }),
  useActions: vi.fn(() => []),
}))

vi.mock('@renderer/features/git', () => ({ useGitLog: vi.fn(() => []) }))
vi.mock('@renderer/hooks/mutation-error', () => ({ toastUserActionError: vi.fn() }))
vi.mock('@shared/background', () => ({ runUserAction: vi.fn() }))

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = (): void => {}
}

describe('FileFinder', () => {
  beforeEach(() => {
    useFileFinderStore.setState({ open: false })
    usePreferencesStore.setState({ sidebarTab: 'files' })
    useProjectSelectionStore.setState({ project: { path: '/repo', name: 'repo' } })
  })

  it('shows useful actions before typing in one palette surface', async () => {
    render(<FileFinder />)
    act(() => useFileFinderStore.getState().setOpen(true))

    expect(
      await screen.findByPlaceholderText('Search commands, projects, files, and commits…'),
    ).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    expect(screen.getByText('Search project contents')).toBeInTheDocument()
    expect(screen.getByText('Open settings')).toBeInTheDocument()
    expect(screen.queryByText('Open board')).not.toBeInTheDocument()
    expect(screen.getByText('Navigate')).toBeInTheDocument()
    expect(screen.queryByText('No matches found')).not.toBeInTheDocument()

    const inputGroup = screen
      .getByPlaceholderText('Search commands, projects, files, and commits…')
      .closest('[data-slot="input-group"]')
    expect(inputGroup).toHaveClass('border-0!')
  })

  it('routes a palette action to the matching sidebar surface', async () => {
    render(<FileFinder />)
    act(() => useFileFinderStore.getState().setOpen(true))

    fireEvent.click(await screen.findByText('Search project contents'))

    expect(usePreferencesStore.getState().sidebarTab).toBe('search')
    await waitFor(() => {
      expect(useFileFinderStore.getState().open).toBe(false)
    })
  })
})
