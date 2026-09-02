import { ENVIRONMENT_NAME_MAX_LENGTH } from '@porcelain/contracts/projects'
import type { EnvironmentStatus } from '@renderer/features/remote'
import { TestIds } from '@shared/test-ids'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RemotesSection } from './remotes-section'

const environmentsMock = vi.fn()
const wslDistributionsMock = vi.fn()
const statusesMock = vi.fn<() => Map<string | null, EnvironmentStatus>>()
const pair = vi.fn()
const open = vi.fn()
const removeEndpoint = vi.fn()
const removeGroup = vi.fn()
const rename = vi.fn()
const setupWsl = vi.fn()

vi.mock('@renderer/features/remote', () => ({
  useEnvironmentStatuses: () => statusesMock(),
  useOpenWindowInEnvironment: () => ({ open }),
  usePairEnvironmentConnection: () => ({ pair, isPending: false, error: null }),
  useRemoteEnvironments: () => environmentsMock(),
  useSetupWslEnvironment: () => ({ setup: setupWsl, pendingDistribution: null, error: null }),
  useWslDistributions: () => wslDistributionsMock(),
  useRemoveEnvironmentEndpoint: () => ({ remove: removeEndpoint, isPending: false }),
  useRemoveRemoteEnvironment: () => ({ remove: removeGroup, pendingId: null }),
  useRenameEnvironment: () => ({ rename, pendingId: undefined }),
}))

const status: EnvironmentStatus = {
  endpoint: 'http://192.168.1.50:43117',
  host: 'workstation',
  id: 'workstation',
  name: 'Workstation',
  platform: 'linux',
  state: 'online',
  version: '0.46.0',
}

/**
 * This device and the saved group are the SAME machine — the case the human hit: one host
 * name, two daemons, and no way to say which row is which until one gets a nickname.
 */
const localStatus: EnvironmentStatus = {
  endpoint: 'http://127.0.0.1:43117',
  host: 'workstation',
  id: null,
  name: 'workstation',
  platform: 'linux',
  state: 'online',
  version: '0.46.0',
}

beforeEach(() => {
  wslDistributionsMock.mockReturnValue([])
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
  statusesMock.mockReturnValue(
    new Map([
      [null, localStatus],
      ['workstation', status],
    ]),
  )
  pair.mockClear()
  open.mockClear()
  removeEndpoint.mockClear()
  removeGroup.mockClear()
  rename.mockClear()
  setupWsl.mockClear()
})

/** Open one row's inline editor, type a name, and click Save. */
function editName(rowId: string, name: string): void {
  fireEvent.click(screen.getByTestId(TestIds.environmentRename(rowId)))
  fireEvent.change(screen.getByTestId(TestIds.environmentNameInput(rowId)), {
    target: { value: name },
  })
  fireEvent.click(screen.getByTestId(TestIds.environmentNameSave(rowId)))
}

describe('RemotesSection', () => {
  it('shows WSL candidates separately with actionable readiness', () => {
    wslDistributionsMock.mockReturnValue([
      {
        name: 'Ubuntu',
        version: 2,
        isDefault: true,
        nodeVersion: null,
        gitVersion: 'git version 2.53.0',
        ready: false,
        issues: ['node-missing', 'npx-missing'],
        managedState: 'available',
        environmentId: null,
        managementError: null,
      },
    ])

    render(<RemotesSection />)

    expect(screen.getByText('Windows Subsystem for Linux')).toBeTruthy()
    expect(screen.getByText('Ubuntu')).toBeTruthy()
    expect(screen.getByText('WSL 2')).toBeTruthy()
    expect(screen.getByText('Default')).toBeTruthy()
    expect(screen.getByText(/Install Node.js 22 or newer inside this distribution/)).toBeTruthy()
    expect(screen.getByText(/does not open them through a Windows UNC path/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Set up and open' })).toBeNull()
  })

  it('sets up a ready WSL distribution through the shell', () => {
    wslDistributionsMock.mockReturnValue([
      {
        name: 'Ubuntu',
        version: 2,
        isDefault: true,
        nodeVersion: 'v22.22.1',
        gitVersion: 'git version 2.53.0',
        ready: true,
        issues: [],
        managedState: 'available',
        environmentId: null,
        managementError: null,
      },
    ])

    render(<RemotesSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Set up and open' }))

    expect(setupWsl).toHaveBeenCalledWith('Ubuntu')
  })

  it('renders one group with LAN and Cloudflare routes and no primary override', () => {
    render(<RemotesSection />)

    expect(screen.getByText('Workstation')).toBeTruthy()
    expect(screen.getByText('LAN')).toBeTruthy()
    expect(screen.getByText('Cloudflare')).toBeTruthy()
    expect(screen.queryByText('Primary')).toBeNull()
    expect(screen.queryByRole('button', { name: /Make .* primary/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /New window/ })).toBeNull()
    expect(screen.queryByText('Connected')).toBeNull()
    expect(screen.getByText('Add connection')).toBeTruthy()
  })

  it('pairs a new Environment without rebinding this window', () => {
    render(<RemotesSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Pair an environment group' }))
    fireEvent.change(screen.getByPlaceholderText('Connection link (https://…/pair#token=…)'), {
      target: { value: 'https://beelink/pair#token=secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Pair environment' }))

    expect(pair).toHaveBeenCalledWith({
      connectionLink: 'https://beelink/pair#token=secret',
      groupId: null,
    })
  })

  it('opens the pairing form for an additional connection', () => {
    render(<RemotesSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Add connection' }))

    expect(screen.getByPlaceholderText('Connection link (https://…/pair#token=…)')).toBeTruthy()
    expect(screen.getAllByText(/LAN, then Tailscale, then Cloudflare/).length).toBeGreaterThan(0)
  })

  it('shows the nickname the daemon announces rather than the saved machine name', () => {
    statusesMock.mockReturnValue(
      new Map([
        [null, localStatus],
        ['workstation', { ...status, name: 'Beelink (work)' }],
      ]),
    )
    render(<RemotesSection />)

    expect(screen.getByTestId(TestIds.environmentName('workstation')).textContent).toBe(
      'Beelink (work)',
    )
    // The two rows are finally distinguishable; the machine name still reads in the sub-line.
    expect(screen.getByTestId(TestIds.environmentName('local')).textContent).toBe('workstation')
  })

  it('falls back to the machine name, never a blank label, when nothing is nicknamed', () => {
    statusesMock.mockReturnValue(new Map([[null, { ...localStatus, name: null }]]))
    render(<RemotesSection />)

    expect(screen.getByTestId(TestIds.environmentName('local')).textContent).toBe('workstation')
  })

  it('names This device when its daemon reports neither a nickname nor a host', () => {
    statusesMock.mockReturnValue(new Map([[null, { ...localStatus, host: null, name: null }]]))
    render(<RemotesSection />)

    expect(screen.getByTestId(TestIds.environmentName('local')).textContent).toBe('This device')
  })

  it('sends the typed nickname to the row the human edited', () => {
    render(<RemotesSection />)
    editName('workstation', 'Beelink (work)')

    expect(rename.mock.calls[0]?.[0]).toEqual({
      environmentId: 'workstation',
      name: 'Beelink (work)',
    })
  })

  /**
   * Trimming belongs to the daemon that owns the nickname — it is what decides whether a
   * name is blank (a CLEAR) or padded. A client that trimmed first would be a second opinion
   * on that, so what the human typed goes over the wire untouched.
   */
  it('passes padding through untouched and leaves trimming to the daemon', () => {
    render(<RemotesSection />)
    editName('workstation', '  Beelink (work)  ')

    expect(rename.mock.calls[0]?.[0]).toEqual({
      environmentId: 'workstation',
      name: '  Beelink (work)  ',
    })
  })

  it('clears a nickname with an empty name and targets This device by null id', () => {
    render(<RemotesSection />)
    fireEvent.click(screen.getByTestId(TestIds.environmentRename('local')))
    fireEvent.change(screen.getByTestId(TestIds.environmentNameInput('local')), {
      target: { value: '   ' },
    })
    fireEvent.keyDown(screen.getByTestId(TestIds.environmentNameInput('local')), { key: 'Enter' })

    expect(rename.mock.calls[0]?.[0]).toEqual({ environmentId: null, name: '   ' })
  })

  /**
   * The contract bounds the name and REJECTS anything longer. Cutting the name down to fit
   * would save a name the human never chose, and they would have no way to know — so the
   * refusal is on screen and the text they typed is still there to fix.
   */
  it('refuses an over-long name out loud instead of quietly cutting it down', () => {
    render(<RemotesSection />)
    const tooLong = 'B'.repeat(ENVIRONMENT_NAME_MAX_LENGTH + 1)
    editName('workstation', tooLong)

    expect(rename).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain(
      `limited to ${ENVIRONMENT_NAME_MAX_LENGTH}`,
    )
    expect(
      screen.getByTestId(TestIds.environmentNameInput('workstation')).getAttribute('value'),
    ).toBe(tooLong)
  })

  /**
   * The rename crosses to another machine. Closing the editor the instant Save is clicked
   * would drop the typed name before anyone knows the write landed — a failure would leave a
   * toast and an empty row. The editor closes when the daemon answers, not before.
   */
  it('keeps the typed name on screen until the write actually lands', () => {
    render(<RemotesSection />)
    editName('workstation', 'Beelink (work)')

    // The mocked hook has not called back yet — that is the in-flight window.
    expect(screen.getByTestId(TestIds.environmentNameInput('workstation'))).toBeTruthy()

    act(() => rename.mock.calls[0]?.[1]?.onSuccess?.())

    expect(screen.queryByTestId(TestIds.environmentNameInput('workstation'))).toBeNull()
  })

  it('does not offer to rename an Environment that is not reachable', () => {
    statusesMock.mockReturnValue(
      new Map([
        [null, localStatus],
        ['workstation', { ...status, state: 'offline' as const }],
      ]),
    )
    render(<RemotesSection />)

    expect(
      screen.getByTestId(TestIds.environmentRename('workstation')).hasAttribute('disabled'),
    ).toBe(true)
  })
})
