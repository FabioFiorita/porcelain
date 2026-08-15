import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RemoteEnvironment, RemoteEnvironmentState } from './remote-daemon'

let state: RemoteEnvironmentState = { activeId: null, environments: [] }
const setWindowRemoteEndpoint = vi.fn()

vi.mock('./daemon', () => ({
  localDaemonPair: (): { url: string; token: string } => ({
    url: 'http://127.0.0.1:43118',
    token: 'pc_admin_local',
  }),
  reloadEnvironmentsCache: async (): Promise<RemoteEnvironmentState> => state,
  setWindowRemoteEndpoint: (...args: unknown[]): void => setWindowRemoteEndpoint(...args),
}))

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

const { probeEnvironment, readEnvironmentStatuses } = await import('./shell-environments')

const DAEMON_INFO = {
  result: { data: { version: '1.2.3', host: 'synthetic-host', platform: 'linux', arch: 'x64' } },
}

function environment(overrides: Partial<RemoteEnvironment> = {}): RemoteEnvironment {
  return {
    id: 'env-1',
    name: 'Synthetic',
    url: 'http://asleep.synthetic',
    token: 'pc_client_remote',
    endpoints: ['http://asleep.synthetic', 'http://awake.synthetic'],
    preferredEndpoint: 'http://asleep.synthetic',
    ...overrides,
  }
}

/** Every daemon answer the shell has to survive, keyed by hostname. */
function stubDaemon(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('asleep.synthetic')) throw new Error('ECONNREFUSED')
      if (url.includes('rejecting.synthetic')) return new Response('', { status: 401 })
      if (url.includes('erroring.synthetic')) return new Response('', { status: 500 })
      if (url.includes('garbled.synthetic')) return new Response('not json at all', { status: 200 })
      if (url.includes('impostor.synthetic')) {
        return new Response(JSON.stringify({ hello: 'from something else' }), { status: 200 })
      }
      return new Response(JSON.stringify(DAEMON_INFO), { status: 200 })
    }),
  )
}

beforeEach(() => {
  state = { activeId: null, environments: [] }
  setWindowRemoteEndpoint.mockClear()
  stubDaemon()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * `unauthorized` must never collapse into `offline`: a box that answers but rejects the token
 * needs re-pairing, and a box that is asleep needs waking. One state sends the human to the
 * wrong remedy.
 */
describe('probeEnvironment', () => {
  it('reports identity when the daemon answers', async () => {
    expect(await probeEnvironment('http://awake.synthetic', 'pc_client_remote')).toEqual({
      state: 'online',
      host: 'synthetic-host',
      platform: 'linux',
      version: '1.2.3',
    })
  })

  it('separates a rejected credential from an unreachable box', async () => {
    const rejected = await probeEnvironment('http://rejecting.synthetic', 'pc_client_stale')
    const unreachable = await probeEnvironment('http://asleep.synthetic', 'pc_client_remote')

    expect(rejected.state).toBe('unauthorized')
    expect(unreachable.state).toBe('offline')
    expect(rejected.host).toBeNull()
    expect(unreachable.version).toBeNull()
  })

  it.each([
    ['a server error', 'http://erroring.synthetic'],
    ['an unparsable body', 'http://garbled.synthetic'],
    ['a 200 that is not a daemon', 'http://impostor.synthetic'],
  ])('treats %s as offline rather than throwing', async (_case, url) => {
    expect(await probeEnvironment(url, 'pc_client_remote')).toEqual({
      state: 'offline',
      host: null,
      platform: null,
      version: null,
    })
  })

  it('carries the protocol version and the credential', async () => {
    const fetchMock = vi.mocked(fetch)
    await probeEnvironment('http://awake.synthetic', 'pc_client_remote')

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://awake.synthetic/trpc/daemonInfo')
    expect(headers.get('authorization')).toBe('Bearer pc_client_remote')
    expect(headers.get(PROTOCOL_VERSION_HEADER)).toBe(String(PROTOCOL_VERSION))
  })
})

describe('readEnvironmentStatuses', () => {
  it('always leads with This device and keeps every saved Environment in order', async () => {
    state = {
      activeId: null,
      environments: [
        environment({ id: 'env-down', url: 'http://asleep.synthetic', endpoints: [] }),
        environment({
          id: 'env-stale',
          url: 'http://rejecting.synthetic',
          endpoints: ['http://rejecting.synthetic'],
          preferredEndpoint: 'http://rejecting.synthetic',
        }),
      ],
    }

    const statuses = await readEnvironmentStatuses()

    expect(statuses.map((status) => status.id)).toEqual([null, 'env-down', 'env-stale'])
    expect(statuses.map((status) => status.state)).toEqual(['online', 'offline', 'unauthorized'])
    expect(statuses[0]?.endpoint).toBe('http://127.0.0.1:43118')
    expect(statuses[1]?.endpoint).toBeNull()
    expect(statuses[2]?.endpoint).toBeNull()
  })

  /**
   * A saved route can go dark while a sibling endpoint (LAN vs tailnet) still answers. Healing
   * the stored preference here is what keeps the next window from re-probing the dead route.
   */
  it('heals the stored route to the endpoint that answered', async () => {
    state = { activeId: 'env-1', environments: [environment()] }

    const statuses = await readEnvironmentStatuses()

    expect(statuses[1]?.state).toBe('online')
    expect(statuses[1]?.endpoint).toBe('http://awake.synthetic')
    expect(state.environments[0]?.url).toBe('http://awake.synthetic')
    expect(setWindowRemoteEndpoint).toHaveBeenCalledWith('env-1', {
      token: 'pc_client_remote',
      url: 'http://awake.synthetic',
    })
  })

  it('leaves the stored route alone when no endpoint answers', async () => {
    state = {
      activeId: 'env-1',
      environments: [environment({ endpoints: ['http://asleep.synthetic'] })],
    }

    const statuses = await readEnvironmentStatuses()

    expect(statuses[1]?.state).toBe('offline')
    expect(state.environments[0]?.url).toBe('http://asleep.synthetic')
    expect(setWindowRemoteEndpoint).not.toHaveBeenCalled()
  })
})
