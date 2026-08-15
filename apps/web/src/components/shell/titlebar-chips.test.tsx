import type { EnvironmentStatus } from '@renderer/features/remote'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TitleBar } from './title-bar'

vi.mock('@renderer/lib/platform', () => ({
  isBrowser: false,
  isLinuxShell: false,
  isE2E: false,
}))

vi.mock('@renderer/hooks/use-updates', () => ({
  useUpdateStatus: () => ({
    state: 'downloaded',
    version: '0.49.0',
    error: null,
    currentVersion: '0.48.0',
  }),
  useInstallUpdate: () => ({ install: vi.fn(), isInstalling: false }),
}))

vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => ({ host: 'studio', platform: 'darwin', version: '0.49.0' }),
}))

vi.mock('@renderer/features/remote', () => ({
  useEnvironmentStatuses: (): Map<string | null, EnvironmentStatus> =>
    new Map([
      [
        null,
        {
          id: null,
          state: 'online',
          host: 'studio',
          platform: 'darwin',
          version: null,
          endpoint: null,
        },
      ],
    ]),
  useRemoteEnvironments: () => ({ activeId: null, defaultId: null, environments: [] }),
  useConnectRemoteEnvironment: () => ({ connect: vi.fn(), pendingId: null }),
  useDisconnectRemoteEnvironment: () => ({ disconnect: vi.fn(), isPending: false }),
  useOpenWindowInEnvironment: () => ({ open: vi.fn() }),
}))

describe('native titlebar chrome', () => {
  it('keeps shell controls while leaving search in the navigation sidebar', () => {
    render(<TitleBar />)

    expect(screen.queryByLabelText('Search commands, projects, files, and commits')).toBeNull()
    expect(screen.getByTestId('update-button')).toBeInTheDocument()
    expect(screen.getByTestId('environment-switcher')).toBeInTheDocument()
  })
})
