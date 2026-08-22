import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DaemonUpdateButton } from './daemon-update-button'

let identity: { host: string | null; platform: string | null; version: string | null }
let environmentName: string | null
let localDaemon: { isLocal: boolean } | undefined
let browser = false
const copyText = vi.fn(async () => {})

vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => identity,
  useEnvironmentName: () => environmentName,
}))

vi.mock('@renderer/hooks/use-local-terminal', () => ({
  useLocalDaemon: () => localDaemon,
}))

vi.mock('@renderer/lib/client-version', () => ({
  clientVersion: () => '0.55.0',
}))

vi.mock('@renderer/lib/platform', () => ({
  get isBrowser(): boolean {
    return browser
  },
}))

vi.mock('@renderer/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/utils')>('@renderer/lib/utils')
  return { ...actual, copyText: (text: string) => copyText(text) }
})

// The real persisted store: dismissal has to survive a remount, which is the whole point.
const { usePreferencesStore } = await import('@renderer/stores/preferences')

beforeEach(() => {
  identity = { host: 'beelink', platform: 'linux', version: '0.53.0' }
  environmentName = null
  localDaemon = { isLocal: false }
  browser = false
  copyText.mockClear()
  usePreferencesStore.setState({ dismissedDaemonUpdates: {} })
})

describe('DaemonUpdateButton', () => {
  it('names the host and both versions so the number never reads as the target', () => {
    render(<DaemonUpdateButton />)
    expect(screen.getByTestId('daemon-update-button')).toHaveAccessibleName(
      'Update beelink — running 0.53.0, this app is 0.55.0',
    )
  })

  it('prefers the Environment nickname over the machine name', () => {
    environmentName = 'beelink soap'
    render(<DaemonUpdateButton />)
    expect(screen.getByTestId('daemon-update-button')).toHaveAccessibleName(
      'Update beelink soap — running 0.53.0, this app is 0.55.0',
    )
  })

  it('renders nothing when the window is on the local daemon', () => {
    localDaemon = { isLocal: true }
    const { container } = render(<DaemonUpdateButton />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing while the shell has not answered yet', () => {
    localDaemon = undefined
    const { container } = render(<DaemonUpdateButton />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the daemon is current', () => {
    identity = { ...identity, version: '0.55.0' }
    const { container } = render(<DaemonUpdateButton />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the versions, the documented command, and copies it', () => {
    render(<DaemonUpdateButton />)
    fireEvent.click(screen.getByTestId('daemon-update-button'))
    expect(screen.getByTestId('daemon-update-command')).toHaveTextContent(
      'systemctl --user restart porcelain-daemon.service',
    )
    expect(screen.getByText(/beelink runs Porcelain 0\.53\.0/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('daemon-update-copy'))
    expect(copyText).toHaveBeenCalledWith('systemctl --user restart porcelain-daemon.service')
  })

  it('stays dismissed for that daemon version across a remount', () => {
    const first = render(<DaemonUpdateButton />)
    fireEvent.click(screen.getByTestId('daemon-update-button'))
    fireEvent.click(screen.getByTestId('daemon-update-dismiss'))
    first.unmount()

    const second = render(<DaemonUpdateButton />)
    expect(second.container.firstChild).toBeNull()
    second.unmount()

    // A newer-but-still-old remote release is a different answer, so it asks again.
    identity = { ...identity, version: '0.54.0' }
    render(<DaemonUpdateButton />)
    expect(screen.getByTestId('daemon-update-button')).toBeTruthy()
  })

  it('treats a browser tab served from loopback as local', () => {
    browser = true
    localDaemon = undefined
    const { container } = render(<DaemonUpdateButton />)
    expect(container.firstChild).toBeNull()
  })
})
