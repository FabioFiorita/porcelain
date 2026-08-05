import {
  useCompanionDispositions,
  useSetCompanionDisposition,
} from '@renderer/hooks/use-companion-dispositions'
import { useSkillsInfo } from '@renderer/hooks/use-skills'
import { useRepoStore } from '@renderer/stores/repo'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanionSection } from './companion-section'

vi.mock('@renderer/hooks/use-skills', () => ({ useSkillsInfo: vi.fn() }))
vi.mock('@renderer/hooks/use-companion-dispositions', () => ({
  useCompanionDispositions: vi.fn(),
  useSetCompanionDisposition: vi.fn(),
}))

const set = vi.fn()

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

  it('shows global install and upgrade commands', () => {
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
