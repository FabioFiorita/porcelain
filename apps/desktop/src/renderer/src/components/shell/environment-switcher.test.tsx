import type { EnvironmentStatus } from '@main/shell-api'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EnvironmentSwitcher } from './environment-switcher'

const identityMock =
  vi.fn<() => { host: string | null; platform: string | null; version: string | null }>()
const statusesMock = vi.fn<() => Map<string | null, EnvironmentStatus>>()
const environmentsMock = vi.fn()
const connect = vi.fn()
const disconnect = vi.fn()
const openInEnv = vi.fn()

vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => identityMock(),
}))

vi.mock('@renderer/hooks/use-environment-status', () => ({
  useEnvironmentStatuses: () => statusesMock(),
}))

vi.mock('@renderer/hooks/use-remote-daemon', () => ({
  useRemoteEnvironments: () => environmentsMock(),
  useConnectRemoteEnvironment: () => ({ connect, pendingId: null }),
  useDisconnectRemoteEnvironment: () => ({ disconnect, isPending: false }),
  useOpenWindowInEnvironment: () => ({ open: openInEnv }),
}))

vi.mock('@renderer/lib/platform', () => ({
  isBrowser: false,
  isLinuxShell: false,
  isE2E: false,
}))

vi.mock('@renderer/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

const beelink = { id: 'beelink', name: 'Beelink', url: 'http://100.64.1.2:43117' }

const status = (
  id: string | null,
  state: EnvironmentStatus['state'],
  host: string | null = null,
  platform: string | null = null,
): EnvironmentStatus => ({
  id,
  state,
  host,
  platform,
  version: null,
  endpoint: null,
})

beforeEach(() => {
  identityMock.mockReturnValue({ host: 'studio', platform: 'darwin', version: '0.40.0' })
  // Local status probe reports this Mac — independent of the bound daemon identity.
  statusesMock.mockReturnValue(new Map([[null, status(null, 'online', 'studio', 'darwin')]]))
  environmentsMock.mockReturnValue({ activeId: null, defaultId: null, environments: [] })
  connect.mockClear()
  disconnect.mockClear()
  openInEnv.mockClear()
  useSettingsDialogStore.setState({ open: false, section: 'general' })
})

describe('EnvironmentSwitcher chip', () => {
  it('is present on a LOCAL window — it is how you go remote, so it cannot be remote-only', () => {
    render(<EnvironmentSwitcher />)
    expect(screen.getByLabelText('Environment: studio')).toBeTruthy()
  })

  it('names the machine the daemon reported when local', () => {
    render(<EnvironmentSwitcher />)
    expect(screen.getByText('studio')).toBeTruthy()
  })

  it('falls back to "This device" before the daemon answers with its host', () => {
    identityMock.mockReturnValue({ host: null, platform: null, version: null })
    statusesMock.mockReturnValue(new Map())
    render(<EnvironmentSwitcher />)
    expect(screen.getByLabelText('Environment: This device')).toBeTruthy()
  })

  it('shows the environment name when this window is on a remote daemon', () => {
    // Bound daemon identity is the remote box — must not rename the chip's local fallback
    // (chip uses the env name) or the This device row (uses local status host).
    identityMock.mockReturnValue({ host: 'beelink', platform: 'linux', version: '0.42.0' })
    statusesMock.mockReturnValue(
      new Map([
        [null, status(null, 'online', 'MacBook-Pro', 'darwin')],
        ['beelink', status('beelink', 'online', 'beelink', 'linux')],
      ]),
    )
    environmentsMock.mockReturnValue({
      activeId: 'beelink',
      defaultId: 'beelink',
      environments: [beelink],
    })
    render(<EnvironmentSwitcher />)
    expect(screen.getByLabelText('Environment: Beelink')).toBeTruthy()
  })
})

describe('EnvironmentSwitcher menu', () => {
  it('lists This device and every saved environment', () => {
    environmentsMock.mockReturnValue({
      activeId: null,
      defaultId: null,
      environments: [beelink],
    })
    render(<EnvironmentSwitcher />)
    fireEvent.click(screen.getByLabelText('Environment: studio'))
    expect(screen.getByText('Beelink')).toBeTruthy()
    expect(screen.getByText('macOS')).toBeTruthy()
  })

  it('names the local row from the local probe, not the bound remote identity', () => {
    // The bug: window on Beelink → identity.host is "beelink" → menu showed beelink twice.
    identityMock.mockReturnValue({ host: 'beelink', platform: 'linux', version: '0.42.0' })
    statusesMock.mockReturnValue(
      new Map([
        [null, status(null, 'online', 'MacBook-Pro', 'darwin')],
        ['beelink', status('beelink', 'online', 'beelink', 'linux')],
      ]),
    )
    environmentsMock.mockReturnValue({
      activeId: 'beelink',
      defaultId: 'beelink',
      environments: [beelink],
    })
    render(<EnvironmentSwitcher />)
    fireEvent.click(screen.getByLabelText('Environment: Beelink'))
    expect(screen.getByText('MacBook-Pro')).toBeTruthy()
    expect(screen.getByText('macOS')).toBeTruthy()
    // Remote row still present under its own name.
    expect(screen.getAllByText('Beelink').length).toBeGreaterThanOrEqual(1)
  })

  it('binds this window to a saved environment when its row is clicked', () => {
    environmentsMock.mockReturnValue({
      activeId: null,
      defaultId: null,
      environments: [beelink],
    })
    render(<EnvironmentSwitcher />)
    fireEvent.click(screen.getByLabelText('Environment: studio'))
    fireEvent.click(screen.getByText('Beelink'))
    expect(connect).toHaveBeenCalledWith('beelink')
  })

  it('opens a fresh window without re-binding this one', () => {
    environmentsMock.mockReturnValue({
      activeId: null,
      defaultId: null,
      environments: [beelink],
    })
    render(<EnvironmentSwitcher />)
    fireEvent.click(screen.getByLabelText('Environment: studio'))
    fireEvent.click(screen.getByLabelText('Open Beelink in new window'))
    expect(openInEnv).toHaveBeenCalledWith({ environmentId: 'beelink' })
    // stopPropagation must keep the row's own switch from also firing.
    expect(connect).not.toHaveBeenCalled()
  })

  it('goes back to the local daemon from the This device row', () => {
    identityMock.mockReturnValue({ host: 'beelink', platform: 'linux', version: '0.42.0' })
    statusesMock.mockReturnValue(
      new Map([
        [null, status(null, 'online', 'MacBook-Pro', 'darwin')],
        ['beelink', status('beelink', 'online', 'beelink', 'linux')],
      ]),
    )
    environmentsMock.mockReturnValue({
      activeId: 'beelink',
      defaultId: 'beelink',
      environments: [beelink],
    })
    render(<EnvironmentSwitcher />)
    fireEvent.click(screen.getByLabelText('Environment: Beelink'))
    fireEvent.click(screen.getByText('MacBook-Pro'))
    expect(disconnect).toHaveBeenCalled()
  })

  it('routes Manage remotes to Settings → Remotes (add lives there, not in the menu)', () => {
    render(<EnvironmentSwitcher />)
    fireEvent.click(screen.getByLabelText('Environment: studio'))
    expect(screen.queryByText('Add remote…')).toBeNull()
    fireEvent.click(screen.getByText('Manage remotes…'))
    const state = useSettingsDialogStore.getState()
    expect(state.open).toBe(true)
    expect(state.section).toBe('remotes')
  })

  it('renders a row for an environment that is asleep rather than hiding it', () => {
    environmentsMock.mockReturnValue({
      activeId: null,
      defaultId: null,
      environments: [beelink],
    })
    statusesMock.mockReturnValue(
      new Map([
        [null, status(null, 'online', 'studio', 'darwin')],
        ['beelink', status('beelink', 'offline')],
      ]),
    )
    render(<EnvironmentSwitcher />)
    fireEvent.click(screen.getByLabelText('Environment: studio'))
    expect(screen.getByText('Beelink')).toBeTruthy()
  })
})
