import { useSkillsInfo } from '@renderer/hooks/use-skills'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralSection } from './general-section'

// The Companion block is shell-only, and jsdom has no preload bridge — `isBrowser`
// would be true by default and hide it. Pin the seam so each test picks its client.
const mockPlatform = vi.hoisted(() => ({ isBrowser: false, isCoarseTouch: () => false }))
vi.mock('@renderer/lib/platform', () => mockPlatform)

// Mock the info hook (never the shell tRPC client underneath it).
vi.mock('@renderer/hooks/use-skills', () => ({ useSkillsInfo: vi.fn() }))

beforeEach(() => {
  mockPlatform.isBrowser = false
  vi.mocked(useSkillsInfo).mockReturnValue({
    version: '2.9.0',
    installCommand: 'npx skills add FabioFiorita/porcelain',
    upgradeCommand: 'npx skills upgrade',
  })
})

describe('GeneralSection', () => {
  // General is the only home the companion-skills commands have since the Agents
  // panel was removed — if this block stops rendering they're unreachable again,
  // and the skills-update toast's "Open settings" action lands on nothing.
  it('gives the companion skills commands a home', () => {
    render(<GeneralSection />)
    expect(screen.getByText('Companion')).toBeTruthy()
    expect(screen.getByText('npx skills add FabioFiorita/porcelain')).toBeTruthy()
    expect(screen.getByText('npx skills upgrade')).toBeTruthy()
    expect(screen.getByText('Current bundle: v2.9.0.')).toBeTruthy()
  })

  it('drops the block in the browser client, which has no shell router to ask', () => {
    mockPlatform.isBrowser = true
    render(<GeneralSection />)
    expect(screen.queryByText('Companion')).toBeNull()
    expect(screen.queryByText('npx skills upgrade')).toBeNull()
    // Still the real General pane, just without the shell-only block.
    expect(screen.getByText('Appearance')).toBeTruthy()
  })
})
