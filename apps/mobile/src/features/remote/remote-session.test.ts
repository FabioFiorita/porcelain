import { orderRemoteEndpoints } from '@porcelain/client-runtime/remote'
import { PROTOCOL_VERSION, publicErrorFixtures } from '@porcelain/contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The daemon seam is not under test here — the endpoint-walk decision in front of it is.
 * `createDaemonClient` becomes an identity tag whose responses this suite drives directly, and
 * every failure is a RAW cause so the shared `parsePublicError` does the classifying. Neither
 * `orderRemoteEndpoints` nor `parsePublicError` is mocked: those are the decisions being bound.
 */
let nextId = 0
vi.mock('expo-crypto', () => ({
  randomUUID: (): string => `env-${++nextId}`,
}))
vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(async (): Promise<void> => {}),
  getItemAsync: vi.fn(async (): Promise<null> => null),
  setItemAsync: vi.fn(async (): Promise<void> => {}),
}))

const LAN = 'http://192.168.1.50:43117'
const TAILNET = 'http://100.64.0.1:43117'
const FUNNEL = 'https://beelink.example.ts.net'

/** What each origin answers on this run. */
const answers = new Map<string, 'ok' | 'unauthorized' | 'update-required'>()

/** A refusal shaped like the daemon's tRPC error payload: the porcelain error rides in `data`. */
class DaemonRefusal extends Error {
  readonly data: { porcelain: unknown }

  constructor(porcelain: unknown) {
    super('daemon refused')
    this.name = 'DaemonRefusal'
    this.data = { porcelain }
  }
}

function answer(baseUrl: string, name: string): unknown {
  const state = answers.get(baseUrl)
  if (state === undefined) throw new TypeError('Network request failed')
  if (state === 'unauthorized') throw new DaemonRefusal(publicErrorFixtures['auth.unauthenticated'])
  if (state === 'update-required') {
    throw new DaemonRefusal(publicErrorFixtures['protocol.update-required'])
  }
  if (name === 'daemonInfo') {
    return {
      version: '1.2.3',
      protocolVersion: PROTOCOL_VERSION,
      host: 'daemon-host',
      platform: 'linux',
      arch: 'x64',
    }
  }
  if (name === 'openRepoPath') return { name: 'repo', path: '/synthetic/repo' }
  return []
}

vi.mock('@/lib/daemon/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/client')>()
  return {
    ...actual,
    forgetDaemonClient: vi.fn(),
    createDaemonClient: vi.fn((baseUrl: string) => ({
      query: async (name: string): Promise<unknown> => answer(baseUrl, name),
      mutation: async (name: string): Promise<unknown> => answer(baseUrl, name),
    })),
  }
})

const markSessionUpdateRequired = vi.fn()
vi.mock('@/lib/daemon/session', async () => {
  const { createSessionHealth } = await import('@porcelain/client-runtime/remote')
  const health = createSessionHealth()
  return {
    configureSession: vi.fn(),
    markSessionUpdateRequired,
    sessionHealth: () => health,
  }
})

const { environmentActions, environmentsStore, getEnvironment } = await import(
  './remote-environment-store'
)
const { currentConnection } = await import('./remote-connection')
const { classifyRemoteFailure, mapAdapterStatus, orderMobileRemoteEndpoints, retryConnection } =
  await import('./remote-session')
const { recoverToPreferredEndpoint } = await import('./remote-session')
const { createDaemonClient, PROBE_TIMEOUT_MS } = await import('@/lib/daemon/client')
const { sessionHealth } = await import('@/lib/daemon/session')

async function pairGroup(): Promise<string> {
  const environment = await environmentActions.add({
    baseUrl: LAN,
    nickname: 'studio',
    token: 'pc_client_test',
  })
  await environmentActions.addEndpoint(environment.id, FUNNEL)
  await environmentActions.setActive(environment.id)
  return environment.id
}

beforeEach(() => {
  nextId = 0
  answers.clear()
  markSessionUpdateRequired.mockClear()
  vi.mocked(createDaemonClient).mockClear()
  environmentsStore.setState({
    activeId: null,
    connection: { kind: 'loading' },
    corrupt: false,
    environments: [],
  })
})

describe('shared endpoint order', () => {
  it('defers to REM-003 for preferred, last-known-good, and stale routes', () => {
    const group = { endpoints: [LAN, FUNNEL], preferredEndpoint: LAN, url: FUNNEL }
    expect(orderMobileRemoteEndpoints(group)).toEqual(orderRemoteEndpoints(group))
    expect(orderMobileRemoteEndpoints(group)).toEqual([LAN, FUNNEL])

    // A last-known-good URL no longer in the group is dropped, not probed.
    const stale = { endpoints: [LAN, FUNNEL], preferredEndpoint: FUNNEL, url: TAILNET }
    expect(orderMobileRemoteEndpoints(stale)).toEqual(orderRemoteEndpoints(stale))
    expect(orderMobileRemoteEndpoints(stale)).toEqual([FUNNEL, LAN])
  })

  it('classifies raw causes with the shared public-error parser', () => {
    expect(classifyRemoteFailure(new TypeError('Network request failed'))).toEqual({
      kind: 'unreachable',
    })
    expect(
      classifyRemoteFailure(new DaemonRefusal(publicErrorFixtures['auth.unauthenticated'])),
    ).toMatchObject({ kind: 'public', error: { code: 'auth.unauthenticated' } })
    expect(
      classifyRemoteFailure(new DaemonRefusal(publicErrorFixtures['protocol.update-required'])),
    ).toMatchObject({ kind: 'update-required' })
  })

  it('maps the native adapter vocabulary onto shared session health', () => {
    expect(mapAdapterStatus('idle')).toBe('idle')
    expect(mapAdapterStatus('connecting')).toBe('connecting')
    expect(mapAdapterStatus('open')).toBe('healthy')
    expect(mapAdapterStatus('reconnecting')).toBe('recovering')
    expect(mapAdapterStatus('update-required')).toBe('update-required')
  })
})

describe('automatic endpoint failover', () => {
  it('walks to the next known endpoint and makes it active when the current one is unreachable', async () => {
    const id = await pairGroup()
    answers.set(FUNNEL, 'ok') // LAN stays unreachable — only Funnel answers.

    await retryConnection()

    expect(getEnvironment(id)?.baseUrl).toBe(FUNNEL)
    expect(currentConnection()).toMatchObject({ kind: 'ready' })
  })

  // The bootstrap probe must ask for the short, connect-failure budget — never the large one
  // regular app traffic gets — or a dead LAN endpoint would hang the whole walk instead of
  // failing over quickly. See `PROBE_TIMEOUT_MS` in `client.ts`.
  it('probes every endpoint in the walk with the connect-failure budget, not the traffic one', async () => {
    await pairGroup()
    answers.set(LAN, 'ok')

    await retryConnection()

    expect(createDaemonClient).toHaveBeenCalledWith(LAN, 'pc_client_test', {
      timeoutMs: PROBE_TIMEOUT_MS,
    })
  })

  it('does not move off the preferred endpoint while it is still the one answering', async () => {
    const id = await pairGroup()
    answers.set(LAN, 'ok')
    answers.set(FUNNEL, 'ok')

    await retryConnection()

    expect(getEnvironment(id)?.baseUrl).toBe(LAN)
  })

  it('climbs back to the preferred endpoint once it is reachable again', async () => {
    const id = await pairGroup()
    answers.set(FUNNEL, 'ok')
    await retryConnection()
    expect(getEnvironment(id)?.baseUrl).toBe(FUNNEL) // Failed over, as proven above.

    answers.set(LAN, 'ok') // The home network is back.
    await recoverToPreferredEndpoint()

    expect(getEnvironment(id)?.baseUrl).toBe(LAN)
    expect(currentConnection()).toMatchObject({ kind: 'ready' })
  })

  it('does not recover while still parked on the endpoint the user explicitly picked', async () => {
    const id = await pairGroup()
    answers.set(LAN, 'ok')
    answers.set(FUNNEL, 'ok')
    await retryConnection()
    expect(getEnvironment(id)?.baseUrl).toBe(LAN)

    // The human opens Settings and pins Funnel on purpose (e.g. LAN is flaky on their router).
    await environmentActions.preferEndpoint(id, FUNNEL)
    await environmentActions.setActiveEndpoint(id, FUNNEL)

    // A foreground/reconnect probe must not fight a preference the user just set.
    await recoverToPreferredEndpoint()

    expect(getEnvironment(id)?.baseUrl).toBe(FUNNEL)
  })

  it('honors a newly preferred endpoint over whichever one merely happens to be active', async () => {
    const id = await pairGroup()
    answers.set(LAN, 'ok')
    answers.set(FUNNEL, 'ok')
    await retryConnection()
    expect(getEnvironment(id)?.baseUrl).toBe(LAN)

    // The user re-points their preference at Funnel while LAN is still perfectly reachable.
    await environmentActions.preferEndpoint(id, FUNNEL)
    await retryConnection()

    expect(getEnvironment(id)?.baseUrl).toBe(FUNNEL)
  })
})

describe('walk stop rules', () => {
  it('goes unauthorized on a public auth refusal instead of trying the next route', async () => {
    const id = await pairGroup()
    answers.set(LAN, 'unauthorized')
    answers.set(FUNNEL, 'ok')

    await retryConnection()

    expect(currentConnection().kind).toBe('unauthorized')
    // The walk stopped: the credential is dead everywhere, not only on this route.
    expect(getEnvironment(id)?.baseUrl).toBe(LAN)
    expect(getEnvironment(id)?.token).toBeNull()
  })

  it('stops on a protocol refusal, retires the session, and reports update-required', async () => {
    answers.set(LAN, 'update-required')
    answers.set(FUNNEL, 'ok')
    await pairGroup()

    await retryConnection()

    expect(currentConnection()).toEqual({ kind: 'update-required' })
    expect(markSessionUpdateRequired).toHaveBeenCalledTimes(1)
  })

  it('reports unreachable on the first exhausted walk, with no query-blip hysteresis', async () => {
    await pairGroup()
    sessionHealth().apply({ type: 'start' })

    await retryConnection()

    const connection = currentConnection()
    expect(connection.kind).toBe('unreachable')
    if (connection.kind === 'unreachable') {
      expect(connection.reachability.source).toBe('endpoint-walk')
      expect(connection.reachability.attempted.map((attempt) => attempt.url)).toEqual([LAN, FUNNEL])
    }
    expect(sessionHealth().status()).toBe('unavailable')
  })
})
