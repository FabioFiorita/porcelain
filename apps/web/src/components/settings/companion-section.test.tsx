import { usePluginInfo } from '@renderer/hooks/use-plugin'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanionSection } from './companion-section'

vi.mock('@renderer/hooks/use-plugin', () => ({ usePluginInfo: vi.fn() }))

describe('CompanionSection', () => {
  beforeEach(() => {
    vi.mocked(usePluginInfo).mockReturnValue({
      version: '1.0.0',
      installCommand: 'npx plugins add FabioFiorita/porcelain',
      marketplaceCommands: [
        '/plugin marketplace add FabioFiorita/porcelain',
        '/plugin install porcelain@porcelain',
      ],
      updateCommands: [
        'npx plugins add FabioFiorita/porcelain',
        '/plugin marketplace update porcelain',
      ],
    })
  })

  it('shows the vendor-neutral install, the Claude marketplace route, and the update', () => {
    render(<CompanionSection />)

    expect(screen.getAllByText('npx plugins add FabioFiorita/porcelain').length).toBeGreaterThan(0)
    // The marketplace route is two commands in one block — joined on a real newline, not
    // truncated to the first. Whitespace normalization would hide a dropped line, so keep it off.
    expect(
      screen.getByText(
        '/plugin marketplace add FabioFiorita/porcelain\n/plugin install porcelain@porcelain',
        { normalizer: (text) => text },
      ),
    ).toBeTruthy()
    expect(screen.getByText(/Bundled plugin: v1\.0\.0/)).toBeTruthy()
  })

  it('does not offer the retired skills.sh commands', () => {
    render(<CompanionSection />)

    expect(screen.queryByText(/npx skills/)).toBeNull()
  })
})
