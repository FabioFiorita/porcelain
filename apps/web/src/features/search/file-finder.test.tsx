import { useFileFinderStore } from '@renderer/stores/file-finder'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileFinder } from './file-finder'

vi.mock('./search-queries', () => ({
  useFileSearch: vi.fn(() => ({ error: null, results: [], isFetching: false })),
}))

vi.mock('@renderer/features/actions', () => ({
  useActionRun: vi.fn(() => vi.fn()),
  useActionRunStore: (selector: (state: { requestLocalRun: () => void }) => unknown) =>
    selector({ requestLocalRun: vi.fn() }),
  useActions: vi.fn(() => []),
}))

vi.mock('@renderer/features/git', () => ({ useGitLog: vi.fn(() => []) }))
vi.mock('@renderer/features/projects', () => ({ useHubInventories: vi.fn(() => []) }))
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
    useHubSelectionStore.setState({ selection: { kind: 'home' } })
  })

  it('shows useful actions before typing in one palette surface', async () => {
    render(<FileFinder />)
    act(() => useFileFinderStore.getState().setOpen(true))

    expect(
      await screen.findByPlaceholderText('Search commands, projects, files, and commits…'),
    ).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    expect(screen.queryByText('Search project contents')).not.toBeInTheDocument()
    expect(screen.getByText('Open settings')).toBeInTheDocument()
    expect(screen.queryByText('Open board')).not.toBeInTheDocument()
    expect(screen.getByText('Navigate')).toBeInTheDocument()
    expect(screen.queryByText('No matches found')).not.toBeInTheDocument()

    const inputGroup = screen
      .getByPlaceholderText('Search commands, projects, files, and commits…')
      .closest('[data-slot="input-group"]')
    expect(inputGroup).toHaveClass('border-0!')
  })

  it('routes a palette action to a remaining sidebar surface', async () => {
    render(<FileFinder />)
    act(() => useFileFinderStore.getState().setOpen(true))

    fireEvent.click(await screen.findByText('Open changes'))

    expect(usePreferencesStore.getState().sidebarTab).toBe('changes')
    await waitFor(() => {
      expect(useFileFinderStore.getState().open).toBe(false)
    })
  })

  it('shows a failed file lookup instead of claiming there are no matches', async () => {
    const { useFileSearch } = await import('./search-queries')
    vi.mocked(useFileSearch).mockReturnValue({
      error: { message: 'The target Environment is offline.' },
      isFetching: false,
      results: [],
    })
    render(<FileFinder />)
    act(() => useFileFinderStore.getState().setOpen(true))
    fireEvent.change(
      await screen.findByPlaceholderText('Search commands, projects, files, and commits…'),
      {
        target: { value: 'needle' },
      },
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('The target Environment is offline.')
    expect(screen.queryByText('No matches found')).not.toBeInTheDocument()
  })

  it('searches every Hub Environment and selects the matching Worktree with its owner target', async () => {
    const { useHubInventories } = await import('@renderer/features/projects')
    vi.mocked(useHubInventories).mockReturnValue([
      {
        environmentId: null,
        current: true,
        inventory: {
          environment: {
            id: 'local',
            name: 'Local',
            host: 'local',
            platform: 'win32',
            arch: 'x64',
          },
          projects: [],
        },
      },
      {
        environmentId: 'remote-connection',
        current: false,
        inventory: {
          environment: {
            id: 'remote',
            name: 'Build server',
            host: 'builder',
            platform: 'linux',
            arch: 'x64',
          },
          projects: [
            {
              id: 'project',
              environmentId: 'remote',
              name: 'Porcelain',
              groupingKey: 'origin',
              path: '/srv/porcelain',
              worktrees: [
                {
                  id: 'review',
                  projectId: 'project',
                  name: 'review-ready',
                  path: '/srv/porcelain-review',
                  branch: 'review-ready',
                  isPrimary: false,
                },
              ],
            },
          ],
        },
      },
    ])
    render(<FileFinder />)
    act(() => useFileFinderStore.getState().setOpen(true))
    fireEvent.change(
      await screen.findByPlaceholderText('Search commands, projects, files, and commits…'),
      { target: { value: 'review-ready' } },
    )

    fireEvent.click(await screen.findByText('Porcelain · review-ready'))
    expect(useHubSelectionStore.getState().selection).toEqual({
      kind: 'worktree',
      environmentId: 'remote',
      projectId: 'project',
      worktreeId: 'review',
      path: '/srv/porcelain-review',
    })
  })
})
