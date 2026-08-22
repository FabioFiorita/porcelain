import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareSection } from './share-section'

const setLan = vi.fn()
const setTailnet = vi.fn()
const setCloudflare = vi.fn()
const openWindow = vi.fn()
/** Which Environment this window is bound to: null = This device, a string = a saved remote. */
let activeId: string | null = null

vi.mock('@renderer/features/remote', () => ({
  useEnvironmentStatuses: () =>
    new Map([['env-beelink', { id: 'env-beelink', name: 'beelink soap' }]]),
  useOpenWindowInEnvironment: () => ({ open: openWindow }),
  useRemoteEnvironments: () => ({
    activeId,
    defaultId: null,
    environments: [
      { id: 'env-beelink', name: 'beelink', url: 'http://beelink:43118', endpoints: [] },
    ],
  }),
  useAccessStatus: () => ({ pairings: [], clients: [], connected: 0, adminTokenPath: '' }),
  useCloudflareStatus: () => ({
    enabled: false,
    envForced: false,
    error: null,
    managed: false,
    url: null,
  }),
  useIssuePairingLink: () => ({ issue: vi.fn(), isPending: false }),
  useLanStatus: () => ({
    enabled: true,
    envForced: false,
    error: null,
    numericUrl: 'http://192.168.1.10:43118',
    port: 43118,
    url: 'http://workstation.local:43118',
  }),
  useRevokeAuthorizedClient: () => ({ revoke: vi.fn(), pendingId: null }),
  useRevokePairingLink: () => ({ revoke: vi.fn(), pendingId: null }),
  useSetCloudflareBind: () => ({ setEnabled: setCloudflare, isPending: false }),
  useSetLanBind: () => ({ setEnabled: setLan, isPending: false }),
  useSetTailnetBind: () => ({ setEnabled: setTailnet, isPending: false }),
  useTailnetStatus: () => ({
    enabled: true,
    envForced: false,
    error: null,
    port: 43118,
    url: 'http://workstation.example:43118',
  }),
}))

beforeEach(() => {
  activeId = null
  openWindow.mockClear()
  setLan.mockClear()
  setTailnet.mockClear()
  setCloudflare.mockClear()
})

describe('ShareSection', () => {
  it('shows LAN plus exclusive Tailscale and Cloudflare, not Funnel', () => {
    render(<ShareSection />)

    expect(screen.getByText('This daemon')).toBeTruthy()
    expect(screen.getByText('Local network')).toBeTruthy()
    expect(screen.getByText('Tailscale')).toBeTruthy()
    expect(screen.getByText('Cloudflare')).toBeTruthy()
    expect(screen.queryByText('Internet')).toBeNull()
    expect(screen.queryByText(/Funnel/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Create LAN link' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create Tailscale link' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create Cloudflare link' })).toBeNull()
  })

  it('toggles Tailscale through the exclusive off-network row', () => {
    render(<ShareSection />)
    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[1] as HTMLElement)
    expect(setTailnet).toHaveBeenCalledWith(false)
  })

  /**
   * A remote-bound window used to lose the whole page. The daemon refuses these procedures to
   * a paired client — correctly — but silence read as "Porcelain cannot do this at all".
   */
  it('says where sharing is administered when the window is on another Environment', () => {
    activeId = 'env-beelink'
    render(<ShareSection />)

    expect(screen.getByTestId('share-not-administrable')).toBeTruthy()
    expect(screen.getByText(/beelink soap/)).toBeTruthy()
    expect(screen.queryByText('Local network')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open a window on This device' }))
    expect(openWindow).toHaveBeenCalledWith({ environmentId: null })
  })
})
