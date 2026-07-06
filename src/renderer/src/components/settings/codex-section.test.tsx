import { useCodexInfo, useInstallCodex } from '@renderer/hooks/use-codex'
import { usePreferencesStore } from '@renderer/stores/preferences'
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
      version: '2.8.0',
    })
    vi.mocked(useInstallCodex).mockReturnValue({
      install: vi.fn(),
      isInstalling: false,
      result: undefined,
      error: null,
    })
  })

  it('offers Install and manual commands when never installed', () => {
    usePreferencesStore.setState({ codexPluginInstalled: false, codexPluginVersion: null })
    render(<CodexSection />)
    expect(screen.getByRole('button', { name: /Install for Codex/ })).toBeInTheDocument()
    expect(screen.getByText('codex plugin add porcelain@porcelain-local')).toBeInTheDocument()
  })

  it('offers Update when installed before versioning (no recorded version)', () => {
    usePreferencesStore.setState({ codexPluginInstalled: true, codexPluginVersion: null })
    render(<CodexSection />)
    expect(screen.getByRole('button', { name: /Update to v2\.8\.0/ })).toBeInTheDocument()
  })

  it('offers Update when the recorded version is behind the bundled one', () => {
    usePreferencesStore.setState({ codexPluginInstalled: true, codexPluginVersion: '2.6.0' })
    render(<CodexSection />)
    expect(screen.getByText(/you have v2\.6\.0/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Update to v2\.8\.0/ })).toBeInTheDocument()
  })

  it('shows up-to-date + a quiet Reinstall when versions match', () => {
    usePreferencesStore.setState({ codexPluginInstalled: true, codexPluginVersion: '2.8.0' })
    render(<CodexSection />)
    expect(screen.getByText(/Up to date/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reinstall' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Update/ })).not.toBeInTheDocument()
  })

  it('records the install and shows up-to-date after a successful install', () => {
    usePreferencesStore.setState({ codexPluginInstalled: false, codexPluginVersion: null })
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
    expect(usePreferencesStore.getState().codexPluginInstalled).toBe(true)
    expect(usePreferencesStore.getState().codexPluginVersion).toBe('2.8.0')
    expect(screen.getByText(/Installed — start a new Codex thread/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reinstall' })).toBeInTheDocument()
  })
})
