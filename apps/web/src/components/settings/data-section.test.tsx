import {
  useCompanionDispositions,
  useCompanionGitVisibility,
  useSetCompanionDisposition,
  useSetCompanionGitVisibility,
} from '@renderer/features/project-data'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataSection } from './data-section'

vi.mock('@renderer/features/project-data', () => ({
  useCompanionDispositions: vi.fn(),
  useCompanionGitVisibility: vi.fn(),
  useSetCompanionDisposition: vi.fn(),
  useSetCompanionGitVisibility: vi.fn(),
}))

const set = vi.fn()
const setVisibility = vi.fn()

describe('DataSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectSelectionStore.setState({ project: { path: '/repo', name: 'repo' } })
    set.mockResolvedValue([])
    vi.mocked(useSetCompanionDisposition).mockReturnValue({ set, isSaving: false })
    setVisibility.mockResolvedValue(undefined)
    vi.mocked(useSetCompanionGitVisibility).mockReturnValue(setVisibility)
    vi.mocked(useCompanionGitVisibility).mockReturnValue({
      data: { hidden: true },
      isPending: false,
    })
    vi.mocked(useCompanionDispositions).mockReturnValue([
      {
        key: 'actions',
        label: 'Saved actions',
        hint: 'Named commands for this project.',
        disposition: 'shared',
        trackedPaths: ['.porcelain/actions.json'],
      },
      {
        key: 'board',
        label: 'Board',
        hint: 'A live work queue.',
        disposition: 'local',
        trackedPaths: [],
      },
    ])
  })

  it('renders a disposition per channel', () => {
    render(<DataSection />)
    expect(screen.getByText('Saved actions')).toBeTruthy()
    expect(screen.getByText('Board')).toBeTruthy()
  })

  it('flips a channel to local', async () => {
    render(<DataSection />)
    fireEvent.click(screen.getByTestId(TestIds.companionDisposition('actions', 'local')))
    expect(set).toHaveBeenCalledWith('actions', 'local')
  })

  it('says what stopped being tracked, and that the file survives', async () => {
    set.mockResolvedValue(['.porcelain/actions.json'])
    render(<DataSection />)
    fireEvent.click(screen.getByTestId(TestIds.companionDisposition('actions', 'local')))
    const note = await screen.findByTestId(TestIds.companionUntracked)
    expect(note.textContent).toContain('still on disk')
  })

  it('asks for a project before offering the choice', () => {
    useProjectSelectionStore.setState({ project: null })
    render(<DataSection />)
    expect(screen.getByText('Open a project to choose.')).toBeTruthy()
  })

  // The old label baked the tracked count into the button as `Local (1)`, which
  // read as "1 local item" — the opposite of what it counts. It now sits in a
  // sentence that says whose files they are and what the switch would do.
  it('reads the tracked count as a consequence, not as a local item count', () => {
    render(<DataSection />)
    const shared = screen.getByTestId(TestIds.companionDispositionState('actions'))
    expect(shared.textContent).toContain('1 file tracked')
    expect(shared.textContent).toContain('Local stages its removal')
    expect(screen.getByTestId(TestIds.companionDisposition('actions', 'local')).textContent).toBe(
      'Local',
    )
  })

  it('says a local channel keeps its file in this clone', () => {
    render(<DataSection />)
    expect(screen.getByTestId(TestIds.companionDispositionState('board')).textContent).toContain(
      'stays in this clone',
    )
  })
})

describe('git visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Sibling describe — it does not inherit the setup above, and the line only
    // renders with a project open.
    useProjectSelectionStore.setState({ project: { path: '/repo', name: 'repo' } })
    setVisibility.mockResolvedValue(undefined)
    vi.mocked(useSetCompanionGitVisibility).mockReturnValue(setVisibility)
    vi.mocked(useSetCompanionDisposition).mockReturnValue({ set, isSaving: false })
    vi.mocked(useCompanionDispositions).mockReturnValue([])
    vi.mocked(useCompanionGitVisibility).mockReturnValue({
      data: { hidden: true },
      isPending: false,
    })
  })

  it('says the companion is hidden, so the toggles below are not mysterious', () => {
    render(<DataSection />)
    expect(screen.getByTestId(TestIds.companionGitVisibility).textContent).toContain(
      'Hidden from git in this clone',
    )
  })

  it('offers to start sharing while hidden', async () => {
    render(<DataSection />)
    fireEvent.click(screen.getByTestId(TestIds.companionGitVisibilityToggle))
    expect(setVisibility).toHaveBeenCalledWith(false)
  })

  it('offers to hide again once visible', async () => {
    vi.mocked(useCompanionGitVisibility).mockReturnValue({
      data: { hidden: false },
      isPending: false,
    })
    render(<DataSection />)
    expect(screen.getByTestId(TestIds.companionGitVisibility).textContent).toContain(
      'Visible to git',
    )
    fireEvent.click(screen.getByTestId(TestIds.companionGitVisibilityToggle))
    expect(setVisibility).toHaveBeenCalledWith(true)
  })
})
