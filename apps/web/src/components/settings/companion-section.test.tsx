import { useSkillsInfo } from '@renderer/hooks/use-skills'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanionSection } from './companion-section'

vi.mock('@renderer/hooks/use-skills', () => ({ useSkillsInfo: vi.fn() }))

describe('CompanionSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSkillsInfo).mockReturnValue({
      version: '3.0.0',
      installCommand: 'npx skills add FabioFiorita/porcelain -g',
      upgradeCommand: 'npx skills upgrade -g',
    })
  })

  it('shows global install and upgrade commands', () => {
    render(<CompanionSection />)
    expect(screen.getByText('npx skills add FabioFiorita/porcelain -g')).toBeTruthy()
    expect(screen.getByText('npx skills upgrade -g')).toBeTruthy()
  })
})
