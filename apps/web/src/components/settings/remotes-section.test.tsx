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
const prefer = vi.fn()
const removeEndpoint = vi.fn()
const removeGroup = vi.fn()

vi.mock('@renderer/features/remote', () => ({
  useConnectRemoteEnvironment: () => ({ connect, pendingId: null }),
  useDisconnectRemoteEnvironment: () => ({ disconnect, isPending: false }),
  useEnvironmentStatuses: () => statusesMock(),
  useOpenWindowInEnvironment: () => ({ open }),
  usePairEnvironmentConnection: () => ({ pair, isPending: false, error: null }),
  usePreferEnvironmentEndpoint: () => ({ prefer, isPending: false }),
  useRemoteEnvironments: () => environmentsMock(),
  useRemoveEnvironmentEndpoint: () => ({ remove: removeEndpoint, isPending: false }),
  useRemoveRemoteEnvironment: () => ({ remove: removeGroup, pendingId: null }),
}))

const status: EnvironmentStatus = {
  endpoint: 'http://192.168.1.50:43117',
  host: 'beelink',
  id: 'beelink',
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
          { kind: 'other', preferred: false, url: 'https://beelink.example.ts.net' },
        ],
        id: 'beelink',
        name: 'Beelink',
        url: 'http://192.168.1.50:43117',
      },
    ],
  })
  statusesMock.mockReturnValue(new Map([['beelink', status]]))
  pair.mockClear()
  connect.mockClear()
  disconnect.mockClear()
  open.mockClear()
  prefer.mockClear()
  removeEndpoint.mockClear()
  removeGroup.mockClear()
})

describe('RemotesSection', () => {
  it('renders one group with its primary and fallback routes', () => {
    render(<RemotesSection />)

    expect(screen.getByText('Beelink')).toBeTruthy()
    expect(screen.getByText('LAN')).toBeTruthy()
    expect(screen.getByText('Funnel / Internet')).toBeTruthy()
    expect(screen.getByText('Primary')).toBeTruthy()
    expect(screen.getByText('Add connection')).toBeTruthy()
  })

  it('sets a fallback route as the group primary route', () => {
    render(<RemotesSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Make Funnel / Internet primary' }))

    expect(prefer).toHaveBeenCalledWith({
      id: 'beelink',
      url: 'https://beelink.example.ts.net',
    })
  })
})
