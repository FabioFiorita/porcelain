import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TitleBar } from './title-bar'

const remoteMock = vi.fn()

vi.mock('@renderer/hooks/use-remote-daemon', () => ({
  useActiveRemoteEnvironment: () => remoteMock(),
}))

vi.mock('@renderer/lib/platform', () => ({
  isBrowser: false,
}))

beforeEach(() => {
  remoteMock.mockReturnValue(null)
  useSettingsDialogStore.setState({ open: false, section: 'general' })
})

describe('TitleBar remote badge', () => {
  it('hides the badge when this window is local', () => {
    render(<TitleBar />)
    expect(screen.queryByLabelText(/Remote environment/i)).toBeNull()
  })

  it('shows Remote · name when this window is on a remote daemon', () => {
    remoteMock.mockReturnValue({
      id: 'beelink',
      name: 'Beelink',
      url: 'http://100.64.1.2:43117',
    })
    render(<TitleBar />)
    expect(screen.getByLabelText('Remote environment: Beelink')).toBeTruthy()
    expect(screen.getByText('Remote')).toBeTruthy()
    expect(screen.getByText(/· Beelink/)).toBeTruthy()
  })

  it('opens Settings → Environments on click', () => {
    remoteMock.mockReturnValue({
      id: 'beelink',
      name: 'Beelink',
      url: 'http://100.64.1.2:43117',
    })
    render(<TitleBar />)
    fireEvent.click(screen.getByLabelText('Remote environment: Beelink'))
    const state = useSettingsDialogStore.getState()
    expect(state.open).toBe(true)
    expect(state.section).toBe('environments')
  })
})
