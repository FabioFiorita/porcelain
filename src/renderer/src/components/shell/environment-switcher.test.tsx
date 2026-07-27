import type { EnvironmentStatus } from '@main/shell-api'
import type { VersionSkew } from '@renderer/lib/version-skew'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EnvironmentSwitcher } from './environment-switcher'

const identityMock =
  vi.fn<() => { host: string | null; platform: string | null; version: string | null }>()
const skewMock = vi.fn<() => VersionSkew | null>()
const statusesMock = vi.fn<() => Map<string | null, EnvironmentStatus>>()
const environmentsMock = vi.fn()
const connect = vi.fn()
const disconnect = vi.fn()
const openInEnv = vi.fn()

vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => identityMock(),
}))

vi.mock('@renderer/hooks/use-daemon-skew', () => ({
  useDaemonSkew: () => skewMock(),
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

const beelink = { id: 'beelink', name: 'Beelink', url: 'http://100.64.1.2:43117' }

const skew: VersionSkew = {
  daemonVersion: '0.28.2',
  appVersion: '0.29.2',
  daemonIsOlder: true,
  message: 'Daemon v0.28.2 · app v0.29.2 — restart the remote daemon to update',
}

const status = (id: string | null, state: EnvironmentStatus['state']): EnvironmentStatus => ({
  id,
  state,
  host: null,
  platform: null,
  version: null,
  endpoint: null,
})

beforeEach(() => {
  identityMock.mockReturnValue({ host: 'studio', platform: 'darwin', version: '0.40.0' })
  skewMock.mockReturnValue(null)
  statusesMock.mockReturnValue(new Map())
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
    render(<EnvironmentSwitcher />)
    expect(screen.getByLabelText('Environment: This device')).toBeTruthy()
  })

  it('shows the environment name when this window is on a remote daemon', () => {
    environmentsMock.mockReturnValue({
      activeId: 'beelink',
      defaultId: 'beelink',
      environments: [beelink],
    })
    render(<EnvironmentSwitcher />)
    expect(screen.getByLabelText('Environment: Beelink')).toBeTruthy()
  })

  it('flags version skew in the accessible name when the daemon differs', () => {
    skewMock.mockReturnValue(skew)
    render(<EnvironmentSwitcher />)
    // The tooltip body carries skew.message but only mounts on hover/focus (Base UI
    // portal), so the chip's own name has to say it.
    expect(screen.getByLabelText(/daemon version mismatch/i)).toBeTruthy()
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
    expect(screen.getByText('Local daemon')).toBeTruthy()
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
    environmentsMock.mockReturnValue({
      activeId: 'beelink',
      defaultId: 'beelink',
      environments: [beelink],
    })
    render(<EnvironmentSwitcher />)
    fireEvent.click(screen.getByLabelText('Environment: Beelink'))
    fireEvent.click(screen.getByText('Local daemon'))
    expect(disconnect).toHaveBeenCalled()
  })

  it('routes Add remote to Settings → Remotes', () => {
    render(<EnvironmentSwitcher />)
    fireEvent.click(screen.getByLabelText('Environment: studio'))
    fireEvent.click(screen.getByText('Add remote…'))
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
    statusesMock.mockReturnValue(new Map([['beelink', status('beelink', 'offline')]]))
    render(<EnvironmentSwitcher />)
    fireEvent.click(screen.getByLabelText('Environment: studio'))
    expect(screen.getByText('Beelink')).toBeTruthy()
  })
})
