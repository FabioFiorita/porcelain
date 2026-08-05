import {
  useCompanionDispositions,
  useCompanionGitVisibility,
  useSetCompanionDisposition,
  useSetCompanionGitVisibility,
} from '@renderer/hooks/use-companion-dispositions'
import { useSkillsInfo } from '@renderer/hooks/use-skills'
import { useRepoStore } from '@renderer/stores/repo'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanionSection } from './companion-section'

vi.mock('@renderer/hooks/use-skills', () => ({ useSkillsInfo: vi.fn() }))
// The skill installer writes to THIS machine's agent config, so it stays shell-only.
// "What git carries" is about the repo and must reach the browser client too.
vi.mock('@renderer/lib/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/lib/platform')>()),
  isBrowser: false,
}))
vi.mock('@renderer/hooks/use-companion-dispositions', () => ({
  useCompanionDispositions: vi.fn(),
  useCompanionGitVisibility: vi.fn(),
  useSetCompanionDisposition: vi.fn(),
  useSetCompanionGitVisibility: vi.fn(),
}))

const set = vi.fn()
const setVisibility = vi.fn()

describe('CompanionSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRepoStore.setState({ repo: { path: '/repo', name: 'repo' } })
    vi.mocked(useSkillsInfo).mockReturnValue({
      version: '3.0.0',
      installCommand: 'npx skills add FabioFiorita/porcelain -g',
      upgradeCommand: 'npx skills upgrade -g',
    })
    set.mockResolvedValue([])
    vi.mocked(useSetCompanionDisposition).mockReturnValue({ set, isSaving: false })
    setVisibility.mockResolvedValue(undefined)
    vi.mocked(useSetCompanionGitVisibility).mockReturnValue(setVisibility)
    vi.mocked(useCompanionGitVisibility).mockReturnValue({ hidden: true })
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

  it('shows global install and upgrade commands in the shell', () => {
    render(<CompanionSection />)
    expect(screen.getByText('npx skills add FabioFiorita/porcelain -g')).toBeTruthy()
    expect(screen.getByText('npx skills upgrade -g')).toBeTruthy()
  })

  it('renders a disposition per channel', () => {
    render(<CompanionSection />)
    expect(screen.getByText('Saved actions')).toBeTruthy()
    expect(screen.getByText('Board')).toBeTruthy()
  })

  it('flips a channel to local', async () => {
    render(<CompanionSection />)
    fireEvent.click(screen.getByTestId(TestIds.companionDisposition('actions', 'local')))
    expect(set).toHaveBeenCalledWith('actions', 'local')
  })

  it('says what stopped being tracked, and that the file survives', async () => {
    set.mockResolvedValue(['.porcelain/actions.json'])
    render(<CompanionSection />)
    fireEvent.click(screen.getByTestId(TestIds.companionDisposition('actions', 'local')))
    const note = await screen.findByTestId(TestIds.companionUntracked)
    expect(note.textContent).toContain('still on disk')
  })

  it('asks for a project before offering the choice', () => {
    useRepoStore.setState({ repo: null })
    render(<CompanionSection />)
    expect(screen.getByText('Open a project to choose.')).toBeTruthy()
  })
})

describe('git visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Sibling describe — it does not inherit the setup above, and the line only
    // renders with a project open.
    useRepoStore.setState({ repo: { path: '/repo', name: 'repo' } })
    setVisibility.mockResolvedValue(undefined)
    vi.mocked(useSetCompanionGitVisibility).mockReturnValue(setVisibility)
    vi.mocked(useSetCompanionDisposition).mockReturnValue({ set, isSaving: false })
    vi.mocked(useCompanionDispositions).mockReturnValue([])
    vi.mocked(useSkillsInfo).mockReturnValue({
      version: '3.0.0',
      installCommand: 'npx skills add FabioFiorita/porcelain -g',
      upgradeCommand: 'npx skills upgrade -g',
    })
    vi.mocked(useCompanionGitVisibility).mockReturnValue({ hidden: true })
  })

  it('says the companion is hidden, so the toggles below are not mysterious', () => {
    render(<CompanionSection />)
    expect(screen.getByTestId(TestIds.companionGitVisibility).textContent).toContain(
      'Hidden from git in this clone',
    )
  })

  it('offers to start sharing while hidden', async () => {
    render(<CompanionSection />)
    fireEvent.click(screen.getByTestId(TestIds.companionGitVisibilityToggle))
    expect(setVisibility).toHaveBeenCalledWith(false)
  })

  it('offers to hide again once visible', async () => {
    vi.mocked(useCompanionGitVisibility).mockReturnValue({ hidden: false })
    render(<CompanionSection />)
    expect(screen.getByTestId(TestIds.companionGitVisibility).textContent).toContain(
      'Visible to git',
    )
    fireEvent.click(screen.getByTestId(TestIds.companionGitVisibilityToggle))
    expect(setVisibility).toHaveBeenCalledWith(true)
  })
})
