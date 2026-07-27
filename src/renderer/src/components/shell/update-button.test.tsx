import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateButton } from './update-button'

const statusMock = vi.fn()
const install = vi.fn()
let isInstalling = false
let isMobile = false
let browser = false

vi.mock('@renderer/hooks/use-updates', () => ({
  useUpdateStatus: () => statusMock(),
  useInstallUpdate: () => ({ install, isInstalling }),
}))

vi.mock('@renderer/hooks/use-mobile', () => ({
  useIsMobile: () => isMobile,
}))

vi.mock('@renderer/lib/platform', () => ({
  get isBrowser() {
    return browser
  },
}))

beforeEach(() => {
  statusMock.mockReturnValue({
    state: 'downloaded',
    version: '0.43.0',
    error: null,
    currentVersion: '0.42.3',
  })
  install.mockClear()
  isInstalling = false
  isMobile = false
  browser = false
})

describe('UpdateButton', () => {
  it('renders nothing until an update is downloaded', () => {
    statusMock.mockReturnValue({
      state: 'up-to-date',
      version: null,
      error: null,
      currentVersion: '0.43.0',
    })
    const { container } = render(<UpdateButton />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing in the browser client', () => {
    browser = true
    const { container } = render(<UpdateButton />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the version label and installs on click', () => {
    render(<UpdateButton />)
    const chip = screen.getByTestId('update-button')
    expect(chip).toHaveAccessibleName('Update to 0.43.0')
    expect(screen.getByText('Update to 0.43.0')).toBeTruthy()
    fireEvent.click(chip)
    expect(install).toHaveBeenCalledOnce()
  })

  it('strips a leading v from the version string', () => {
    statusMock.mockReturnValue({
      state: 'downloaded',
      version: 'v0.43.0',
      error: null,
      currentVersion: '0.42.3',
    })
    render(<UpdateButton />)
    expect(screen.getByLabelText('Update to 0.43.0')).toBeTruthy()
  })

  it('collapses to icon-only on phone', () => {
    isMobile = true
    render(<UpdateButton />)
    expect(screen.getByLabelText('Update to 0.43.0')).toBeTruthy()
    expect(screen.queryByText('Update to 0.43.0')).toBeNull()
  })

  it('disables while installing', () => {
    isInstalling = true
    render(<UpdateButton />)
    expect(screen.getByTestId('update-button')).toBeDisabled()
  })
})
