import type { EnvironmentEndpoint } from '@renderer/hooks/use-remote-daemon'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EnvironmentEndpoints } from './environment-endpoints'

const addEndpoint = vi.fn<(input: { id: string; url: string }) => Promise<boolean>>()
const preferEndpoint = vi.fn()
const removeEndpoint = vi.fn()
const addErrorMock = vi.fn<() => string | null>()

vi.mock('@renderer/hooks/use-remote-daemon', () => ({
  useAddEnvironmentEndpoint: () => ({
    addEndpoint,
    isPending: false,
    error: addErrorMock(),
  }),
  usePreferEnvironmentEndpoint: () => ({ preferEndpoint, pendingUrl: null }),
  useRemoveEnvironmentEndpoint: () => ({ removeEndpoint, pendingUrl: null }),
}))

const TAILNET = 'http://beelink.tailnet.ts.net:43117'
const LAN = 'http://beelink.local:43117'

const endpoint = (over: Partial<EnvironmentEndpoint> & { url: string }): EnvironmentEndpoint => ({
  kind: 'other',
  preferred: false,
  ...over,
})

beforeEach(() => {
  addEndpoint.mockResolvedValue(true)
  addEndpoint.mockClear()
  preferEndpoint.mockClear()
  removeEndpoint.mockClear()
  addErrorMock.mockReturnValue(null)
})

describe('EnvironmentEndpoints', () => {
  it('lists every address with the network it reaches the machine over', () => {
    render(
      <EnvironmentEndpoints
        environmentId="env-1"
        endpoints={[
          endpoint({ url: TAILNET, kind: 'tailnet' }),
          endpoint({ url: LAN, kind: 'lan' }),
        ]}
        liveEndpoint={null}
      />,
    )
    expect(screen.getByText(TAILNET)).toBeTruthy()
    expect(screen.getByText('Tailscale')).toBeTruthy()
    expect(screen.getByText(LAN)).toBeTruthy()
    expect(screen.getByText('Local network')).toBeTruthy()
  })

  it('marks the address that actually answered, and only that one', () => {
    render(
      <EnvironmentEndpoints
        environmentId="env-1"
        endpoints={[
          endpoint({ url: TAILNET, kind: 'tailnet' }),
          endpoint({ url: LAN, kind: 'lan' }),
        ]}
        liveEndpoint={LAN}
      />,
    )
    const liveRow = screen.getByTestId(TestIds.environmentEndpoint(LAN))
    expect(within(liveRow).getByText('Live')).toBeTruthy()
    const otherRow = screen.getByTestId(TestIds.environmentEndpoint(TAILNET))
    expect(within(otherRow).queryByText('Live')).toBeNull()
  })

  it('offers Prefer only where it would change something, and pins the right address', () => {
    render(
      <EnvironmentEndpoints
        environmentId="env-1"
        endpoints={[
          endpoint({ url: TAILNET, kind: 'tailnet', preferred: true }),
          endpoint({ url: LAN, kind: 'lan' }),
        ]}
        liveEndpoint={null}
      />,
    )
    const preferredRow = screen.getByTestId(TestIds.environmentEndpoint(TAILNET))
    expect(within(preferredRow).getByText('Preferred')).toBeTruthy()
    expect(within(preferredRow).queryByRole('button', { name: 'Prefer' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Prefer' }))
    expect(preferEndpoint).toHaveBeenCalledWith({ id: 'env-1', url: LAN })
  })

  it('removes an address by url', () => {
    render(
      <EnvironmentEndpoints
        environmentId="env-1"
        endpoints={[
          endpoint({ url: TAILNET, kind: 'tailnet' }),
          endpoint({ url: LAN, kind: 'lan' }),
        ]}
        liveEndpoint={null}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: `Remove ${LAN}` }))
    expect(removeEndpoint).toHaveBeenCalledWith({ id: 'env-1', url: LAN })
  })

  it('never offers to remove the last address — that would leave no way in', () => {
    render(
      <EnvironmentEndpoints
        environmentId="env-1"
        endpoints={[endpoint({ url: LAN, kind: 'lan' })]}
        liveEndpoint={LAN}
      />,
    )
    expect(screen.queryByRole('button', { name: `Remove ${LAN}` })).toBeNull()
  })

  it('adds an address and clears the field only once it landed', async () => {
    render(
      <EnvironmentEndpoints
        environmentId="env-1"
        endpoints={[endpoint({ url: TAILNET, kind: 'tailnet' })]}
        liveEndpoint={null}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add address' }))
    const field = screen.getByLabelText('Address') as HTMLInputElement
    fireEvent.change(field, { target: { value: LAN } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(addEndpoint).toHaveBeenCalledWith({ id: 'env-1', url: LAN })
    await screen.findByRole('button', { name: 'Add address' })
  })

  it('keeps the typed address on screen with the failure, so a typo is one edit away', async () => {
    addEndpoint.mockResolvedValue(false)
    addErrorMock.mockReturnValue('Could not reach that address')
    render(
      <EnvironmentEndpoints
        environmentId="env-1"
        endpoints={[endpoint({ url: TAILNET, kind: 'tailnet' })]}
        liveEndpoint={null}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add address' }))
    const field = screen.getByLabelText('Address') as HTMLInputElement
    fireEvent.change(field, { target: { value: 'http://typo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Could not reach that address')).toBeTruthy()
    expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('http://typo')
  })
})
