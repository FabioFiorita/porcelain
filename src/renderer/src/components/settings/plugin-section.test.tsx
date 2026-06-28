import {
  useCursorPluginInfo,
  useInstallCursorPlugin,
  useInstallPlugin,
  usePluginInfo,
} from '@renderer/hooks/use-plugin'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginSection } from './plugin-section'

// Mock the domain hooks (never the tRPC proxy), per the component-test convention.
vi.mock('@renderer/hooks/use-plugin', () => ({
  usePluginInfo: vi.fn(),
  useInstallPlugin: vi.fn(),
  useCursorPluginInfo: vi.fn(),
  useInstallCursorPlugin: vi.fn(),
}))

describe('PluginSection CTA', () => {
  beforeEach(() => {
    vi.mocked(usePluginInfo).mockReturnValue({
      marketplaceDir: '/home/.porcelain/plugin',
      commands: ['claude plugin install porcelain@porcelain'],
      version: '2.0.0',
    })
    vi.mocked(useInstallPlugin).mockReturnValue({
      install: vi.fn(),
      isInstalling: false,
      result: undefined,
      error: null,
    })
    vi.mocked(useCursorPluginInfo).mockReturnValue(undefined)
    vi.mocked(useInstallCursorPlugin).mockReturnValue({
      install: vi.fn(),
      isInstalling: false,
      result: undefined,
      error: null,
    })
  })

  it('offers Install when never installed', () => {
    usePreferencesStore.setState({ pluginInstalled: false, pluginVersion: null })
    render(<PluginSection target="claude" />)
    expect(screen.getByRole('button', { name: /Install for Claude Code/ })).toBeInTheDocument()
  })

  it('offers Update when installed before versioning (no recorded version)', () => {
    usePreferencesStore.setState({ pluginInstalled: true, pluginVersion: null })
    render(<PluginSection target="claude" />)
    expect(screen.getByRole('button', { name: /Update to v2\.0\.0/ })).toBeInTheDocument()
  })

  it('offers Update when the recorded version is behind the bundled one', () => {
    usePreferencesStore.setState({ pluginInstalled: true, pluginVersion: '1.0.0' })
    render(<PluginSection target="claude" />)
    expect(screen.getByText(/you have v1\.0\.0/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Update to v2\.0\.0/ })).toBeInTheDocument()
  })

  it('shows up-to-date + a quiet Reinstall when versions match', () => {
    usePreferencesStore.setState({ pluginInstalled: true, pluginVersion: '2.0.0' })
    render(<PluginSection target="claude" />)
    expect(screen.getByText(/Up to date/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reinstall' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Update/ })).not.toBeInTheDocument()
  })
})
