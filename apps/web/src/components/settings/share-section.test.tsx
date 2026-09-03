import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareSection } from './share-section'

const setLan = vi.fn()
const setTailnet = vi.fn()
const setCloudflare = vi.fn()
const saveCloudflareHostname = vi.fn()
const openWindow = vi.fn()
const issue = vi.fn()
/** Which Environment this window is bound to: null = This device, a string = a saved remote. */
let activeId: string | null = null
let customCloudflareUrl: string | null = null

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
    customUrl: customCloudflareUrl,
    url: null,
  }),
  useIssuePairingLink: () => ({ issue, isPending: false }),
  useIssueManagedEnvironmentBundle: () => ({ issue: vi.fn(), isPending: false }),
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
  useSetCloudflareHostname: () => ({ save: saveCloudflareHostname, isPending: false }),
  useSetLanBind: () => ({ setEnabled: setLan, isPending: false }),
  useSetTailnetBind: () => ({ setEnabled: setTailnet, isPending: false }),
  useTailnetStatus: () => ({
    enabled: true,
    envForced: false,
    error: null,
    port: 43118,
    url: 'http://workstation.example:43118',
  }),
  useWslDistributions: () => [],
}))

beforeEach(() => {
  activeId = null
  customCloudflareUrl = null
  setLan.mockClear()
  setTailnet.mockClear()
  setCloudflare.mockClear()
  saveCloudflareHostname.mockClear()
  issue.mockReset()
})

describe('ShareSection', () => {
  it('shows LAN plus exclusive Tailscale and Cloudflare, not Funnel', () => {
    render(<ShareSection />)

    expect(screen.getByText('This daemon')).toBeTruthy()
    expect(screen.getByText('Local network')).toBeTruthy()
    expect(screen.getByText('Tailscale')).toBeTruthy()
    expect(screen.getByText('Cloudflare quick tunnel')).toBeTruthy()
    expect(screen.getByText('Custom Cloudflare hostname')).toBeTruthy()
    expect(screen.queryByText('Internet')).toBeNull()
    expect(screen.queryByText(/Funnel/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Create LAN link' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create Tailscale link' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create Cloudflare link' })).toBeNull()
  })

  it('saves a custom hostname for the existing QR pairing flow', () => {
    render(<ShareSection />)

    fireEvent.change(screen.getByPlaceholderText('https://porcelain.example.com'), {
      target: { value: 'remote.example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(saveCloudflareHostname).toHaveBeenCalledWith('remote.example.com')
    expect(screen.getByText(/Cloudflare service URL:/)).toBeTruthy()
  })

  it('offers the saved custom hostname as a Cloudflare pairing route', async () => {
    customCloudflareUrl = 'https://remote.example.com'
    issue.mockResolvedValueOnce({
      url: 'https://remote.example.com/pair#token=pc_pair_example',
    })
    render(<ShareSection />)

    fireEvent.change(screen.getByPlaceholderText('Device name, e.g. My iPhone'), {
      target: { value: 'Away laptop' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create Cloudflare link' }))

    expect(issue).toHaveBeenCalledWith({
      label: 'Away laptop',
      baseUrl: 'https://remote.example.com',
    })
    expect(await screen.findByAltText('Pairing QR code')).toBeTruthy()
  })

  it('toggles Tailscale through the exclusive off-network row', () => {
    render(<ShareSection />)
    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[1] as HTMLElement)
    expect(setTailnet).toHaveBeenCalledWith(false)
  })

  it('administers this device without leaving a remote-focused window', () => {
    activeId = 'env-beelink'
    render(<ShareSection />)

    expect(screen.queryByTestId('share-not-administrable')).toBeNull()
    expect(screen.getByText('Local network')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create LAN link' })).toBeTruthy()
  })

  it('shows a generated pairing link as a QR code', async () => {
    issue.mockResolvedValueOnce({
      url: 'http://192.168.1.10:43118/pair#token=pc_pair_example',
    })
    render(<ShareSection />)

    fireEvent.change(screen.getByPlaceholderText('Device name, e.g. My iPhone'), {
      target: { value: 'My phone' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create LAN link' }))

    const qr = await screen.findByAltText('Pairing QR code')
    expect((qr as HTMLImageElement).src.startsWith('data:image/svg+xml')).toBe(true)
  })
})
