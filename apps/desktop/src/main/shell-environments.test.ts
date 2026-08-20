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

/** The nickname `awake.synthetic` announces; every other stub daemon has none. */
const NICKNAME = 'Beelink (work)'
const ENVIRONMENT_IDENTITY = {
  result: {
    data: {
      id: 'env-synthetic',
      name: NICKNAME,
      host: 'synthetic-host',
      platform: 'linux',
      arch: 'x64',
    },
  },
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

/**
 * Fired while a nicknamed daemon is answering the identity question — the window in which a
 * rename can land, which is the whole point of the lost-update test below.
 */
let onIdentityFetch: (() => void) | null = null

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
      if (url.endsWith('/trpc/environmentIdentity')) {
        // A daemon that is UP (daemonInfo answers) but cannot answer this one question:
        // a transient 503, and a 200 whose body says nothing about a name. Neither is an
        // answer, and neither may be allowed to overwrite what the human already named.
        if (url.includes('flaky.synthetic')) return new Response('', { status: 503 })
        if (url.includes('muddled.synthetic')) {
          return new Response(JSON.stringify({ result: { data: {} } }), { status: 200 })
        }
        onIdentityFetch?.()
        // Only the awake remote has been nicknamed. The local daemon answers 404, standing
        // in for a daemon too old to know the procedure at all.
        return url.includes('awake.synthetic')
          ? new Response(JSON.stringify(ENVIRONMENT_IDENTITY), { status: 200 })
          : new Response('', { status: 404 })
      }
      return new Response(JSON.stringify(DAEMON_INFO), { status: 200 })
    }),
  )
}

beforeEach(() => {
  state = { activeId: null, environments: [] }
  onIdentityFetch = null
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
    expect(
      await probeEnvironment('http://awake.synthetic', 'pc_client_remote', { identity: true }),
    ).toEqual({
      state: 'online',
      host: 'synthetic-host',
      name: NICKNAME,
      platform: 'linux',
      version: '1.2.3',
    })
  })

  /**
   * The nickname is what tells two daemons on ONE machine apart, so its absence must never
   * leave a row blank: a daemon too old to know the procedure answers 404, which IS an
   * answer, and its machine name is a perfectly good display name.
   */
  it('falls back to the machine name when the daemon announces no nickname', async () => {
    const status = await probeEnvironment('http://127.0.0.1:43118', 'pc_admin_local', {
      identity: true,
    })
    expect(status.name).toBe('synthetic-host')
    expect(status.host).toBe('synthetic-host')
  })

  /**
   * The distinction the saved nickname depends on: a daemon that could not answer has NOT
   * told us it has no nickname. Reporting the machine name here is what would overwrite the
   * human's label — so an unanswered question reports no name at all.
   */
  it.each([
    ['a transient failure', 'http://flaky.synthetic'],
    ['an unreadable identity body', 'http://muddled.synthetic'],
  ])('reports no name — not the machine name — after %s', async (_case, url) => {
    const status = await probeEnvironment(url, 'pc_client_remote', { identity: true })

    expect(status.state).toBe('online')
    expect(status.host).toBe('synthetic-host')
    expect(status.name).toBeNull()
  })

  /** The identity read is a second round trip; callers that only want liveness skip it. */
  it('asks for identity only when the caller wants the name', async () => {
    const status = await probeEnvironment('http://awake.synthetic', 'pc_client_remote')

    expect(vi.mocked(fetch).mock.calls.map(([input]) => String(input))).toEqual([
      'http://awake.synthetic/trpc/daemonInfo',
    ])
    expect(status.name).toBeNull()
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
      name: null,
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

  /**
   * The saved name is frozen at pairing time — for two daemons on one machine it is the
   * SAME hostname twice. Healing it from the owning daemon is what makes a nickname show up
   * in every shell-side surface, and what keeps it there once that box goes to sleep.
   */
  it('heals the saved name to the nickname the daemon announces', async () => {
    state = { activeId: 'env-1', environments: [environment({ name: 'synthetic-host' })] }

    const statuses = await readEnvironmentStatuses()

    expect(statuses[1]?.name).toBe(NICKNAME)
    expect(state.environments[0]?.name).toBe(NICKNAME)
  })

  /**
   * The regression that made healing dangerous: the daemon is UP, so the row is online and
   * the state gets rewritten — but the one call that carries the nickname hiccuped. Writing
   * the machine name in would replace the human's label with the exact string the nickname
   * exists to escape, permanently: the next fan-out would read that name back as the truth.
   */
  it.each([
    ['a transient failure', 'http://flaky.synthetic'],
    ['an unreadable identity body', 'http://muddled.synthetic'],
  ])('keeps the saved nickname when the identity call meets %s', async (_case, url) => {
    state = {
      activeId: 'env-1',
      environments: [
        environment({ name: NICKNAME, url, endpoints: [url], preferredEndpoint: url }),
      ],
    }

    const statuses = await readEnvironmentStatuses()

    expect(statuses[1]?.state).toBe('online')
    expect(statuses[1]?.name).toBeNull()
    expect(state.environments[0]?.name).toBe(NICKNAME)
  })

  /**
   * The fan-out takes seconds, and a rename can land inside it. The name the probe read is
   * then stale, and writing it back would silently revert what the human just typed — the
   * lost update `updateRemoteEnvironmentState` exists to prevent.
   */
  it('does not revert a rename that landed while the probe was in flight', async () => {
    state = { activeId: 'env-1', environments: [environment({ name: 'synthetic-host' })] }
    onIdentityFetch = (): void => {
      state = {
        ...state,
        environments: state.environments.map((env) => ({ ...env, name: 'Typed mid-probe' })),
      }
    }

    await readEnvironmentStatuses()

    expect(state.environments[0]?.name).toBe('Typed mid-probe')
  })

  it('keeps the last known nickname when the Environment is offline', async () => {
    state = {
      activeId: 'env-1',
      environments: [
        environment({
          name: NICKNAME,
          url: 'http://asleep.synthetic',
          endpoints: ['http://asleep.synthetic'],
        }),
      ],
    }

    const statuses = await readEnvironmentStatuses()

    expect(statuses[1]?.state).toBe('offline')
    expect(statuses[1]?.name).toBeNull()
    expect(state.environments[0]?.name).toBe(NICKNAME)
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
