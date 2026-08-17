import type { EnvironmentStatus } from '@renderer/features/remote'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RemotesSection } from './remotes-section'

const environmentsMock = vi.fn()
const statusesMock = vi.fn<() => Map<string | null, EnvironmentStatus>>()
const pair = vi.fn()
const connect = vi.fn()
const disconnect = vi.fn()
const open = vi.fn()
const removeEndpoint = vi.fn()
const removeGroup = vi.fn()

vi.mock('@renderer/features/remote', () => ({
  useConnectRemoteEnvironment: () => ({ connect, pendingId: null }),
  useDisconnectRemoteEnvironment: () => ({ disconnect, isPending: false }),
  useEnvironmentStatuses: () => statusesMock(),
  useOpenWindowInEnvironment: () => ({ open }),
  usePairEnvironmentConnection: () => ({ pair, isPending: false, error: null }),
  useRemoteEnvironments: () => environmentsMock(),
  useRemoveEnvironmentEndpoint: () => ({ remove: removeEndpoint, isPending: false }),
  useRemoveRemoteEnvironment: () => ({ remove: removeGroup, pendingId: null }),
}))

vi.mock('@renderer/lib/platform', () => ({ isBrowser: false }))

const status: EnvironmentStatus = {
  endpoint: 'http://192.168.1.50:43117',
  host: 'workstation',
  id: 'workstation',
  platform: 'linux',
  state: 'online',
  version: '0.46.0',
}

beforeEach(() => {
  environmentsMock.mockReturnValue({
    activeId: null,
    defaultId: null,
    environments: [
      {
        endpoints: [
          { kind: 'lan', preferred: true, url: 'http://192.168.1.50:43117' },
          { kind: 'other', preferred: false, url: 'https://random-words-here.trycloudflare.com' },
        ],
        id: 'workstation',
        name: 'Workstation',
        url: 'http://192.168.1.50:43117',
      },
    ],
  })
  statusesMock.mockReturnValue(new Map([['workstation', status]]))
  pair.mockClear()
  connect.mockClear()
  disconnect.mockClear()
  open.mockClear()
  removeEndpoint.mockClear()
  removeGroup.mockClear()
})

describe('RemotesSection', () => {
  it('renders one group with LAN and Cloudflare routes and no primary override', () => {
    render(<RemotesSection />)

    expect(screen.getByText('Workstation')).toBeTruthy()
    expect(screen.getByText('LAN')).toBeTruthy()
    expect(screen.getByText('Cloudflare')).toBeTruthy()
    expect(screen.queryByText('Primary')).toBeNull()
    expect(screen.queryByRole('button', { name: /Make .* primary/ })).toBeNull()
    expect(screen.getByText('Add connection')).toBeTruthy()
  })

  it('opens the pairing form for an additional connection', () => {
    render(<RemotesSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Add connection' }))

    expect(screen.getByPlaceholderText('Connection link (https://…/pair#token=…)')).toBeTruthy()
    expect(screen.getAllByText(/LAN, then Tailscale, then Cloudflare/).length).toBeGreaterThan(0)
  })
})
