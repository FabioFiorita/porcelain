import { useCodexInfo, useInstallCodex } from '@renderer/hooks/use-codex'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CodexSection } from './codex-section'

// Mock the domain hooks (never the tRPC proxy), per the component-test convention.
vi.mock('@renderer/hooks/use-codex', () => ({
  useCodexInfo: vi.fn(),
  useInstallCodex: vi.fn(),
}))

describe('CodexSection CTA', () => {
  beforeEach(() => {
    vi.mocked(useCodexInfo).mockReturnValue({
      marketplaceDir: '/home/.porcelain/codex-plugin',
      commands: [
        'codex plugin marketplace add /home/.porcelain/codex-plugin',
        'codex plugin add porcelain@porcelain-local',
      ],
      version: '2.6.0',
    })
    vi.mocked(useInstallCodex).mockReturnValue({
      install: vi.fn(),
      isInstalling: false,
      result: undefined,
      error: null,
    })
  })

  it('offers Install for Codex and manual commands', () => {
    render(<CodexSection />)
    expect(screen.getByRole('button', { name: /Install for Codex/ })).toBeInTheDocument()
    expect(screen.getByText('codex plugin add porcelain@porcelain-local')).toBeInTheDocument()
  })

  it('shows reinstall after a successful install', () => {
    vi.mocked(useInstallCodex).mockReturnValue({
      install: vi.fn(),
      isInstalling: false,
      result: {
        ok: true,
        output: 'installed',
        marketplaceDir: '/home/.porcelain/codex-plugin',
        commands: [],
      },
      error: null,
    })

    render(<CodexSection />)
    expect(screen.getByRole('button', { name: /Reinstall for Codex/ })).toBeInTheDocument()
    expect(screen.getByText(/Installed — start a new Codex thread/i)).toBeInTheDocument()
  })
})
