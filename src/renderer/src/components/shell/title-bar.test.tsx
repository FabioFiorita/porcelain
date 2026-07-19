import type { VersionSkew } from '@renderer/lib/version-skew'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TitleBar } from './title-bar'

const remoteMock = vi.fn()
const skewMock = vi.fn<() => VersionSkew | null>()

vi.mock('@renderer/hooks/use-remote-daemon', () => ({
  useActiveRemoteEnvironment: () => remoteMock(),
}))

vi.mock('@renderer/hooks/use-daemon-skew', () => ({
  useDaemonSkew: () => skewMock(),
}))

vi.mock('@renderer/lib/platform', () => ({
  isBrowser: false,
  isLinuxShell: false,
  isE2E: false,
}))

// The repo-identity anchor reaches through domain hooks (recents query) that need a
// QueryClient this test doesn't wire; it has its own coverage, so stub it out here —
// these tests are scoped to the remote badge.
vi.mock('./repo-identity-button', () => ({ RepoIdentityButton: () => null }))

const beelink = { id: 'beelink', name: 'Beelink', url: 'http://100.64.1.2:43117' }

const skew: VersionSkew = {
  daemonVersion: '0.28.2',
  appVersion: '0.29.2',
  daemonIsOlder: true,
  message: 'Daemon v0.28.2 · app v0.29.2 — restart the remote daemon to update',
}

beforeEach(() => {
  remoteMock.mockReturnValue(null)
  skewMock.mockReturnValue(null)
  useSettingsDialogStore.setState({ open: false, section: 'general' })
})

describe('TitleBar remote badge', () => {
  it('hides the badge when this window is local', () => {
    render(<TitleBar />)
    expect(screen.queryByLabelText(/Remote environment/i)).toBeNull()
  })

  it('shows the environment name when this window is on a remote daemon', () => {
    remoteMock.mockReturnValue(beelink)
    render(<TitleBar />)
    expect(screen.getByLabelText('Remote environment: Beelink')).toBeTruthy()
    expect(screen.getByText('Beelink')).toBeTruthy()
  })

  it('opens Settings → Environments on click', () => {
    remoteMock.mockReturnValue(beelink)
    render(<TitleBar />)
    fireEvent.click(screen.getByLabelText('Remote environment: Beelink'))
    const state = useSettingsDialogStore.getState()
    expect(state.open).toBe(true)
    expect(state.section).toBe('environments')
  })

  it('flags version skew on the chip when the daemon differs', () => {
    remoteMock.mockReturnValue(beelink)
    skewMock.mockReturnValue(skew)
    render(<TitleBar />)
    // The chip's accessible name calls out the mismatch (the tooltip body — which
    // carries skew.message — only mounts on hover/focus via the Base UI portal).
    expect(screen.getByLabelText(/daemon version mismatch/i)).toBeTruthy()
    expect(screen.queryByLabelText('Remote environment: Beelink')).toBeNull()
  })

  it('shows the plain remote label (no mismatch) when versions match', () => {
    remoteMock.mockReturnValue(beelink)
    skewMock.mockReturnValue(null)
    render(<TitleBar />)
    expect(screen.getByLabelText('Remote environment: Beelink')).toBeTruthy()
    expect(screen.queryByLabelText(/mismatch/i)).toBeNull()
  })
})
