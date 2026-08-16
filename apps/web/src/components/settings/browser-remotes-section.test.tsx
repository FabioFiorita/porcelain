import {
  browserEnvironmentConnections,
  setBrowserEnvironmentConnections,
} from '@renderer/lib/environment-sessions'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserRemotesSection } from './browser-remotes-section'

function renderSection(): void {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BrowserRemotesSection />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  setBrowserEnvironmentConnections([])
})

describe('BrowserRemotesSection', () => {
  it('adds through the UI only after daemon identity verification and does not render the token', async () => {
    const response = new Response(
      JSON.stringify([
        {
          result: {
            data: {
              version: '0.52.1',
              protocolVersion: 1,
              host: 'secondary-box',
              platform: 'linux',
              arch: 'x64',
            },
          },
        },
      ]),
      { headers: { 'content-type': 'application/json' } },
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response.clone()),
    )
    renderSection()

    fireEvent.change(screen.getByLabelText('Connection label'), {
      target: { value: 'Secondary' },
    })
    fireEvent.change(screen.getByLabelText('Daemon URL'), {
      target: { value: 'http://127.0.0.1:43220' },
    })
    fireEvent.change(screen.getByLabelText('Client token'), {
      target: { value: 'pc_client_secondary_secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verify and add' }))

    await waitFor(() => expect(screen.getByText('Secondary')).toBeTruthy())
    expect(screen.getByText(/secondary-box · linux · daemon 0.52.1/)).toBeTruthy()
    expect(screen.queryByDisplayValue('pc_client_secondary_secret')).toBeNull()
    expect(browserEnvironmentConnections()).toHaveLength(1)
    vi.unstubAllGlobals()
  })

  it('keeps the configured row when its daemon is offline and allows removal', async () => {
    setBrowserEnvironmentConnections([
      {
        id: 'offline-secondary',
        name: 'Offline secondary',
        url: 'http://127.0.0.1:43221',
        token: 'pc_client_offline_secret',
      },
    ])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )
    renderSection()

    await waitFor(() => expect(screen.getByText('Offline secondary')).toBeTruthy())
    await waitFor(() =>
      expect(screen.getByText('Not reachable — check the URL or daemon')).toBeTruthy(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove Offline secondary' }))
    await waitFor(() => expect(screen.queryByText('Offline secondary')).toBeNull())
    expect(browserEnvironmentConnections()).toEqual([])
    vi.unstubAllGlobals()
  })
})
