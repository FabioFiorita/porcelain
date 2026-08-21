import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { actionsContractFixtures } from '@porcelain/contracts/actions'
import { projectsContractFixtures } from '@porcelain/contracts/projects'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RemoteEnvironment, RemoteEnvironmentState } from './remote-daemon'

// The shell router is Electron-shaped but every daemon request in it is plain `fetch`.
// These mocks keep the native shell and the on-disk environment state out of the way so the
// requests themselves are what the test observes.
vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: (): null => null, getAllWindows: (): [] => [] },
  clipboard: { readImage: vi.fn(), readText: vi.fn(), writeText: vi.fn() },
  nativeTheme: { shouldUseDarkColors: false, themeSource: 'system' },
  shell: { showItemInFolder: vi.fn() },
}))

let state: RemoteEnvironmentState = { activeId: null, environments: [] }

vi.mock('./daemon', () => ({
  getDefaultEnvironmentId: (): null => null,
  localDaemonPair: (): { url: string; token: string } => ({
    url: 'http://127.0.0.1:43118',
    token: 'pc_admin_local',
  }),
  reloadEnvironmentsCache: async (): Promise<RemoteEnvironmentState> => state,
  setDefaultEnvironmentId: vi.fn(),
  setWindowRemoteEndpoint: vi.fn(),
  windowEnvironmentId: (): null => null,
}))

vi.mock('./local-terminal-paths', () => ({
  loadLocalTerminalPaths: async (): Promise<{ paths: Record<string, string> }> => ({ paths: {} }),
  localTerminalPathKey: (): string => 'key',
  updateLocalTerminalPaths: vi.fn(),
}))

vi.mock('./plugin-assets', () => ({
  PLUGIN_VERSION: '1.0.0',
  agentPluginRepository: (): string => 'repository',
  claudePluginCommands: (): readonly string[] => ['marketplace'],
}))

vi.mock('./updater', () => ({
  checkForUpdates: vi.fn(),
  installUpdate: vi.fn(),
  updateStatus: (): { state: 'idle' } => ({ state: 'idle' }),
}))

// Same reason as './window': the popover module reaches for the real Electron window
// APIs at import time, which this suite deliberately keeps out of the graph.
vi.mock('./quick-add-window', () => ({
  closeQuickAddFrom: vi.fn(),
}))

vi.mock('./window', () => ({
  createWindow: vi.fn(),
  switchWindowEnvironment: switchWindowEnvironmentMock,
  windowInitFor: vi.fn(),
}))

const switchWindowEnvironmentMock = vi.fn()

vi.mock('./remote-daemon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./remote-daemon')>()
  return {
    ...actual,
    loadRemoteEnvironmentState: async (): Promise<RemoteEnvironmentState> => state,
    updateRemoteEnvironmentState: async (
      update: (current: RemoteEnvironmentState) => RemoteEnvironmentState,
    ): Promise<RemoteEnvironmentState> => {
      state = update(state)
      return state
    },
  }
})

const { shellRouter } = await import('./shell-api')

const GRANT = `pc_pair_3f2a1c88-0f4d-4b6e-9a11-2c7d5e8b0a34_${'a'.repeat(64)}`
const DAEMON_INFO = {
  result: { data: { version: '1.0.0', host: 'synthetic-host', platform: 'linux', arch: 'x64' } },
}
const HUB_INVENTORY = { result: { data: projectsContractFixtures.hubInventory.output } }
const PROJECT_ACTIONS = { result: { data: actionsContractFixtures.actions.output } }

interface SeenRequest {
  url: string
  method: string
  body: string | null
  headers: Headers
}

const seen: SeenRequest[] = []

function stubDaemon(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      seen.push({
        url,
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
        headers: new Headers(init?.headers),
      })
      if (url.endsWith('/pair')) {
        return new Response(
          JSON.stringify({
            token: 'pc_client_remote',
            client: { id: 'c1', label: 'Desktop', createdAt: '2026-01-01T00:00:00.000Z' },
          }),
          { status: 200 },
        )
      }
      if (url.includes('unauthorized.synthetic')) return new Response('', { status: 401 })
      if (url.includes('offline.synthetic')) throw new Error('offline')
      if (url.includes('/trpc/daemonInfo')) {
        return new Response(JSON.stringify(DAEMON_INFO), { status: 200 })
      }
      if (url.includes('/trpc/hubInventory')) {
        return new Response(JSON.stringify(HUB_INVENTORY), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('/trpc/actions')) {
        return new Response(JSON.stringify(PROJECT_ACTIONS), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('/trpc/revokeCurrentClient')) {
        return new Response(JSON.stringify({ result: { data: null } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200 })
    }),
  )
}

function request(match: string): SeenRequest {
  const found = seen.find((entry) => entry.url.includes(match))
  if (found === undefined) throw new Error(`no request matched ${match}: ${seen.map((s) => s.url)}`)
  return found
}

function expectsProtocol(entry: SeenRequest): void {
  expect(entry.headers.get(PROTOCOL_VERSION_HEADER)).toBe(String(PROTOCOL_VERSION))
}

const caller = (): ReturnType<typeof shellRouter.createCaller> =>
  // The procedures under test never touch the sender; the shell's window handle is mocked away.
  shellRouter.createCaller({ sender: {} as never })

beforeEach(() => {
  seen.length = 0
  switchWindowEnvironmentMock.mockClear()
  state = { activeId: null, environments: [] }
  stubDaemon()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * The shell talks to daemons on four request shapes — redeem a connection link, probe with
 * `recentRepos`, read identity with `daemonInfo`, revoke a temporary credential — and every
 * one crosses the same versioned boundary. The interesting failure is a partial rollout: one
 * of these keeping its old headers would make a healthy machine look like an outdated client
 * only in the switcher, or only while pairing.
 */
describe('shell daemon requests', () => {
  it('versions the pairing exchange and both authenticated probes', async () => {
    const result = await caller().pairEnvironmentConnection({
      connectionLink: `http://synthetic.local:43117/pair#token=${GRANT}`,
      connectThisWindow: false,
    })

    expect(result.merged).toBe(false)

    const pairing = request('/pair')
    expect(pairing.url).toBe('http://synthetic.local:43117/pair')
    expect(pairing.method).toBe('POST')
    expect(pairing.body).toBe(JSON.stringify({ credential: GRANT }))
    expect(pairing.headers.get('content-type')).toBe('application/json')
    // Pairing is the unauthenticated exchange; the version must not have added a credential.
    expect(pairing.headers.get('authorization')).toBeNull()
    expectsProtocol(pairing)

    const probe = request('/trpc/recentRepos')
    expect(probe.method).toBe('GET')
    expect(probe.headers.get('authorization')).toBe('Bearer pc_client_remote')
    expectsProtocol(probe)

    const identity = request('/trpc/daemonInfo')
    expect(identity.method).toBe('GET')
    expect(identity.headers.get('authorization')).toBe('Bearer pc_client_remote')
    expectsProtocol(identity)
  })

  it('versions the tRPC revocation of a merged endpoint credential', async () => {
    const twin: RemoteEnvironment = {
      id: 'env-1',
      name: 'Synthetic',
      url: 'http://synthetic.local:43117',
      token: 'pc_client_twin',
      endpoints: ['http://synthetic.local:43117'],
      preferredEndpoint: 'http://synthetic.local:43117',
      host: 'synthetic-host',
    }
    state = { activeId: 'env-1', environments: [twin] }

    const result = await caller().pairEnvironmentConnection({
      connectionLink: `http://synthetic.tail1234.ts.net/pair#token=${GRANT}`,
      connectThisWindow: false,
    })

    expect(result.merged).toBe(true)

    const revoke = request('/trpc/revokeCurrentClient')
    expect(revoke.method).toBe('POST')
    // The one-shot pairing credential is what gets revoked — not the group's own token.
    expect(revoke.headers.get('authorization')).toBe('Bearer pc_client_remote')
    expectsProtocol(revoke)
  })

  it('versions the identity probe behind the Environment status list', async () => {
    const statuses = await caller().environmentStatuses()

    expect(statuses[0]?.state).toBe('online')
    const identity = request('/trpc/daemonInfo')
    expect(identity.headers.get('authorization')).toBe('Bearer pc_admin_local')
    expectsProtocol(identity)
  })

  it('fans out live Hub inventories and omits offline or unauthorized Environments', async () => {
    const environment = (id: string, url: string): RemoteEnvironment => ({
      id,
      name: id,
      url,
      token: `pc_client_${id}`,
      endpoints: [url],
      preferredEndpoint: url,
    })
    state = {
      activeId: null,
      environments: [
        environment('env-online', 'http://online.synthetic'),
        environment('env-offline', 'http://offline.synthetic'),
        environment('env-unauthorized', 'http://unauthorized.synthetic'),
      ],
    }

    const inventories = await caller().hubInventories()

    expect(inventories).toHaveLength(2)
    expect(inventories.map((source) => source.environmentId)).toEqual([null, 'env-online'])
    expect(inventories.map((source) => source.current)).toEqual([true, false])
    expect(seen.filter((entry) => entry.url.includes('/trpc/hubInventory'))).toHaveLength(2)
    for (const entry of seen.filter((request) => request.url.includes('/trpc/hubInventory'))) {
      expectsProtocol(entry)
    }
  })

  it('reads one Project roster from the Environment the caller named', async () => {
    state = {
      activeId: null,
      environments: [
        {
          id: 'env-online',
          name: 'env-online',
          url: 'http://online.synthetic',
          token: 'pc_client_env-online',
          endpoints: ['http://online.synthetic'],
          preferredEndpoint: 'http://online.synthetic',
        },
      ],
    }

    const actions = await caller().projectActions({
      groupId: 'env-online',
      projectId: 'proj-alpha',
    })

    expect(actions.map((action) => action.id)).toEqual(
      actionsContractFixtures.actions.output.map((action) => action.id),
    )
    const asked = request('http://online.synthetic/trpc/actions')
    // The remote Environment's own credential, never This device's admin token.
    expect(asked.headers.get('authorization')).toBe('Bearer pc_client_env-online')
    // A query goes out as GET with its input encoded in the URL.
    expect(decodeURIComponent(asked.url)).toContain('"projectId":"proj-alpha"')
    expectsProtocol(asked)
  })

  it('omits an Environment that went offline instead of surfacing a stale roster', async () => {
    state = {
      activeId: null,
      environments: [
        {
          id: 'env-offline',
          name: 'env-offline',
          url: 'http://offline.synthetic',
          token: 'pc_client_env-offline',
          endpoints: ['http://offline.synthetic'],
          preferredEndpoint: 'http://offline.synthetic',
        },
      ],
    }

    expect(
      await caller().projectActions({ groupId: 'env-offline', projectId: 'proj-alpha' }),
    ).toEqual([])
    expect(
      await caller().projectActions({ groupId: 'env-unknown', projectId: 'proj-alpha' }),
    ).toEqual([])
    expect(seen.filter((entry) => entry.url.includes('/trpc/actions'))).toHaveLength(0)
  })
})
