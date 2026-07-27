import type { ConnectedDevices } from '@backend/api'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectedDevicesCard } from './connected-devices-card'

const devicesMock = vi.fn<() => ConnectedDevices | undefined>()
const revoke = vi.fn()

vi.mock('@renderer/hooks/use-devices', () => ({
  useConnectedDevices: () => devicesMock(),
  useRevokeDevice: () => ({ revoke, isPending: false }),
}))

const device = (over: Partial<ConnectedDevices['devices'][number]> = {}) => ({
  id: 'dev-1',
  label: 'Safari on iPad',
  createdAt: Date.now() - 86_400_000,
  lastSeenAt: Date.now(),
  connections: 0,
  terminals: 0,
  threads: 0,
  ...over,
})

beforeEach(() => {
  devicesMock.mockReturnValue({ devices: [], sharedTokenConnections: 0 })
  revoke.mockClear()
})

describe('ConnectedDevicesCard', () => {
  it('says what a connected device is doing, not just that it is here', () => {
    devicesMock.mockReturnValue({
      devices: [device({ connections: 1, terminals: 2, threads: 1, repo: '~/code/porcelain' })],
      sharedTokenConnections: 0,
    })
    render(<ConnectedDevicesCard />)
    expect(screen.getByText('Safari on iPad')).toBeTruthy()
    expect(
      screen.getByText('Connected · 2 terminals · 1 agent thread · ~/code/porcelain'),
    ).toBeTruthy()
  })

  it('falls back to last seen for a paired but disconnected device', () => {
    devicesMock.mockReturnValue({
      devices: [device({ lastSeenAt: Date.now() - 3 * 3_600_000 })],
      sharedTokenConnections: 0,
    })
    render(<ConnectedDevicesCard />)
    expect(screen.getByText('Last seen 3h ago')).toBeTruthy()
  })

  it('explains the empty roster instead of showing a blank box', () => {
    render(<ConnectedDevicesCard />)
    expect(screen.getByText(/No paired devices yet/)).toBeTruthy()
  })

  it('advises about shared-token clients only when there are any', () => {
    render(<ConnectedDevicesCard />)
    expect(screen.queryByText(/shared token/)).toBeNull()

    devicesMock.mockReturnValue({ devices: [], sharedTokenConnections: 2 })
    render(<ConnectedDevicesCard />)
    expect(screen.getByText(/2 clients connected with the shared token/)).toBeTruthy()
  })

  it('revokes the right device, and only through the confirm step', () => {
    devicesMock.mockReturnValue({
      devices: [device({ id: 'dev-42' })],
      sharedTokenConnections: 0,
    })
    render(<ConnectedDevicesCard />)

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    expect(revoke).not.toHaveBeenCalled()

    // Two buttons read "Revoke" once the dialog is open — the row's and the confirm.
    const confirm = screen.getAllByRole('button', { name: 'Revoke' }).at(-1)
    if (confirm === undefined) throw new Error('confirm button missing')
    fireEvent.click(confirm)
    expect(revoke).toHaveBeenCalledWith('dev-42')
  })
})
