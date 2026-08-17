import {
  browserEnvironmentConnections,
  setBrowserEnvironmentConnections,
} from '@renderer/lib/environment-sessions'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { BrowserRemotesSection } from './browser-remotes-section'

beforeEach(() => {
  window.localStorage.clear()
  setBrowserEnvironmentConnections([])
})

describe('BrowserRemotesSection', () => {
  it('describes this tab as the only environment and does not offer a second daemon form', () => {
    render(<BrowserRemotesSection />)

    expect(screen.getByText('This tab')).toBeTruthy()
    expect(screen.getByText('One environment')).toBeTruthy()
    expect(screen.getByText(/porcelain-daemon access issue/)).toBeTruthy()
    expect(screen.queryByLabelText('Connection label')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Verify and add' })).toBeNull()
  })

  it('lets a leftover saved connection be removed', () => {
    setBrowserEnvironmentConnections([
      {
        id: 'leftover',
        name: 'Old extra daemon',
        url: 'http://127.0.0.1:43221',
        token: 'pc_client_leftover',
      },
    ])
    render(<BrowserRemotesSection />)

    expect(screen.getByText('Old extra daemon')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Old extra daemon' }))
    expect(screen.queryByText('Old extra daemon')).toBeNull()
    expect(browserEnvironmentConnections()).toEqual([])
  })
})
