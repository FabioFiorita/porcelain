import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppUpdatesSection, DaemonUpdatesSection, ElectronUpdatesSection } from './updates-section'

const checkDaemonUpdate = vi.fn(async () => ({
  currentVersion: '0.52.1',
  latestVersion: '0.60.0',
  restartable: true,
}))
const restartDaemon = vi.fn(async () => undefined)
const daemonClient = {
  daemonInfo: {
    query: vi.fn(async () => ({ version: '0.52.1', host: 'beelink' })),
  },
  checkDaemonUpdate: { mutate: checkDaemonUpdate },
  restartDaemon: { mutate: restartDaemon },
}
const doubles = vi.hoisted(() => ({ environmentClientFor: vi.fn() }))
const appUpdateStatus = {
  state: 'unavailable' as const,
  version: null,
  error: null,
  currentVersion: '0.61.4',
  unavailableReason: 'Automatic updates are available in the installed Porcelain app.',
}

vi.mock('@renderer/hooks/use-updates', () => ({
  useUpdateStatus: () => appUpdateStatus,
  useCheckForUpdates: () => ({ check: vi.fn(), isChecking: false }),
  useInstallUpdate: () => ({ install: vi.fn(), isInstalling: false }),
}))

vi.mock('@renderer/features/remote', () => ({
  useEnvironmentStatuses: () =>
    new Map([
      [null, { name: 'Local', state: 'online' }],
      ['remote', { name: 'Work server', state: 'online' }],
    ]),
  useRemoteEnvironments: () => ({
    environments: [{ id: 'remote', name: 'Work server', endpoints: [] }],
  }),
}))

vi.mock('@renderer/lib/environment-sessions', () => ({
  environmentClientFor: (environmentId: string | null) => {
    doubles.environmentClientFor(environmentId)
    return { client: daemonClient, session: null }
  },
  useEnvironmentSessionsRevision: () => 0,
}))

vi.mock('@renderer/lib/trpc', () => ({
  trpc: { useUtils: () => ({ client: daemonClient }) },
}))

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  )
}

beforeEach(() => {
  checkDaemonUpdate.mockClear()
  restartDaemon.mockClear()
  doubles.environmentClientFor.mockClear()
})

describe('DaemonUpdatesSection', () => {
  it('checks and restarts the explicitly targeted Environment daemon', async () => {
    render(<DaemonUpdatesSection environmentId="remote" environmentName="Work server" />, {
      wrapper,
    })

    expect(await screen.findByText('Porcelain v0.52.1')).toBeVisible()
    expect(doubles.environmentClientFor.mock.calls[0]?.[0]).toBe('remote')
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }))

    expect(await screen.findByText(/Version 0.60.0 is published/)).toBeVisible()
    expect(checkDaemonUpdate).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Update and restart' }))
    await waitFor(() => expect(restartDaemon).toHaveBeenCalledOnce())
  })
})

describe('ElectronUpdatesSection', () => {
  it('keeps desktop and selected-Environment updates in one page', async () => {
    render(<ElectronUpdatesSection />, { wrapper })

    expect(screen.getByRole('heading', { name: 'Desktop app' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Environment daemon' })).toBeVisible()
    expect(screen.getByText(/without changing the Environment shown by this window/)).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Daemon Environment' })).toBeVisible()
    expect(await screen.findByText('Local daemon')).toBeVisible()
  })
})

describe('AppUpdatesSection', () => {
  it('disables a development-shell update check and explains the installed-app boundary', () => {
    render(<AppUpdatesSection />)

    expect(screen.getByRole('button', { name: 'Check for updates' })).toBeDisabled()
    expect(
      screen.getByText('Automatic updates are available in the installed Porcelain app.'),
    ).toBeVisible()
  })
})
