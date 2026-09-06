import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareSection } from './share-section'

const setLan = vi.fn()
const setTailnet = vi.fn()
const setCloudflare = vi.fn()
const saveCloudflareHostname = vi.fn()
const openWindow = vi.fn()
const issue = vi.fn()
const platform = vi.hoisted(() => ({ isWindowsShell: false }))
vi.mock('@renderer/lib/platform', () => platform)
/** Which Environment this window is bound to: null = This device, a string = a saved remote. */
let activeId: string | null = null
let customCloudflareUrl: string | null = null
let managedEnabled = false
let managedUrl: string | null = null
let lanAvailable = true
let tailnetForced = false

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
    enabled: managedEnabled,
    envForced: false,
    error: null,
    managed: managedEnabled,
    customUrl: customCloudflareUrl,
    url: managedUrl,
  }),
  useIssuePairingLink: () => ({ issue, isPending: false }),
  useLanStatus: () => ({
    enabled: lanAvailable,
    envForced: false,
    error: null,
    numericUrl: lanAvailable ? 'http://192.168.1.10:43118' : null,
    port: 43118,
    url: lanAvailable ? 'http://workstation.local:43118' : null,
  }),
  useRevokeAuthorizedClient: () => ({ revoke: vi.fn(), pendingId: null }),
  useRevokePairingLink: () => ({ revoke: vi.fn(), pendingId: null }),
  useSetCloudflareBind: () => ({ setEnabled: setCloudflare, isPending: false }),
  useSetCloudflareHostname: () => ({ save: saveCloudflareHostname, isPending: false }),
  useSetLanBind: () => ({ setEnabled: setLan, isPending: false }),
  useSetTailnetBind: () => ({ setEnabled: setTailnet, isPending: false }),
  useTailnetStatus: () => ({
    enabled: true,
    envForced: tailnetForced,
    error: null,
    port: 43118,
    url: 'http://workstation.example:43118',
  }),
}))

beforeEach(() => {
  platform.isWindowsShell = false
  activeId = null
  customCloudflareUrl = null
  managedEnabled = false
  managedUrl = null
  lanAvailable = true
  tailnetForced = false
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
    expect(screen.getByRole('switch', { name: 'Cloudflare' })).toBeTruthy()
    expect(screen.getByText('Custom Cloudflare hostname')).toBeTruthy()
    expect(screen.queryByText('Internet')).toBeNull()
    expect(screen.queryByText(/Funnel/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Create LAN link' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create Tailscale link' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create Cloudflare link' })).toBeNull()
  })

  it.each(['LAN', 'Cloudflare'])(
    'shares only the local Windows daemon through its %s link',
    async (route) => {
      platform.isWindowsShell = true
      customCloudflareUrl = 'https://remote.example.com'
      issue.mockResolvedValue({
        url: 'https://remote.example.com/pair#token=pc_pair_example',
      })
      render(<ShareSection />)
      expect(screen.queryByRole('button', { name: 'Create Windows + WSL link' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Create Tailscale link' })).toBeNull()
      fireEvent.change(screen.getByPlaceholderText('Device name, e.g. My iPhone'), {
        target: { value: 'Phone' },
      })
      fireEvent.click(screen.getByRole('button', { name: `Create ${route} link` }))
      expect(issue).toHaveBeenCalledExactlyOnceWith({
        label: 'Phone',
        baseUrl: route === 'LAN' ? 'http://192.168.1.10:43118' : customCloudflareUrl,
      })
      expect(await screen.findByAltText('Pairing QR code')).toBeTruthy()
    },
  )

  it('saves a custom hostname for the existing QR pairing flow', () => {
    render(<ShareSection />)

    fireEvent.change(screen.getByPlaceholderText('https://porcelain.example.com'), {
      target: { value: 'remote.example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Use custom hostname' }))

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

  it('shows custom sharing as on, protects its LAN listener, and can turn it off', () => {
    customCloudflareUrl = 'https://remote.example.com'
    render(<ShareSection />)
    expect(screen.getByRole('switch', { name: 'Cloudflare' }).getAttribute('aria-checked')).toBe(
      'true',
    )
    expect(
      screen.getByRole('switch', { name: 'Local network' }).hasAttribute('data-disabled'),
    ).toBe(true)
    fireEvent.click(screen.getByRole('switch', { name: 'Cloudflare' }))
    expect(setCloudflare).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('switches back to managed sharing and drops the obsolete hostname draft after success', () => {
    customCloudflareUrl = 'https://remote.example.com'
    const view = render(<ShareSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Use managed tunnel' }))
    expect(setCloudflare).toHaveBeenCalledExactlyOnceWith(true)
    customCloudflareUrl = null
    managedEnabled = true
    managedUrl = 'https://example.trycloudflare.com'
    view.rerender(<ShareSection />)
    expect(
      (screen.getByRole('textbox', { name: 'Custom Cloudflare hostname' }) as HTMLInputElement)
        .value,
    ).toBe('')
    expect(screen.getByRole('switch', { name: 'Cloudflare' }).getAttribute('aria-checked')).toBe(
      'true',
    )
  })

  it('does not offer a stale URL from a stopped managed tunnel', () => {
    managedUrl = 'https://example.trycloudflare.com'
    render(<ShareSection />)
    expect(screen.queryByRole('button', { name: 'Create Cloudflare link' })).toBeNull()
  })

  it('requires LAN before applying a custom hostname or pairing through it', () => {
    lanAvailable = false
    customCloudflareUrl = 'https://remote.example.com'
    render(<ShareSection />)
    expect(
      screen.getByRole('button', { name: 'Use custom hostname' }).hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.queryByRole('button', { name: 'Create Cloudflare link' })).toBeNull()
    expect(
      screen.getByRole('switch', { name: 'Local network' }).hasAttribute('data-disabled'),
    ).toBe(false)
  })

  it('does not allow a custom hostname to override startup-owned Tailscale', () => {
    tailnetForced = true
    render(<ShareSection />)
    expect(
      screen.getByRole('textbox', { name: 'Custom Cloudflare hostname' }).hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Use custom hostname' }).hasAttribute('disabled'),
    ).toBe(true)
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
