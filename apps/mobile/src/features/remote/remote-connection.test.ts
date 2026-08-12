import { beforeEach, describe, expect, it, vi } from 'vitest'

let nextId = 0
vi.mock('expo-crypto', () => ({
  randomUUID: (): string => `env-${++nextId}`,
}))
vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(async (): Promise<void> => {}),
  getItemAsync: vi.fn(async (): Promise<null> => null),
  setItemAsync: vi.fn(async (): Promise<void> => {}),
}))
vi.mock('@/lib/daemon/client', () => ({
  forgetDaemonClient: vi.fn(),
}))

const { environmentActions, environmentsStore } = await import('./remote-environment-store')
const { currentConnection, recordReachabilityFailure, recordReachabilitySuccess } = await import(
  './remote-connection'
)

const LAN = 'http://192.168.1.50:43117'
const FUNNEL = 'https://beelink.example.ts.net'

const ready = {
  daemonVersion: '1.2.3',
  kind: 'ready',
  reachability: {
    attempted: [],
    consecutiveFailures: 0,
    source: 'endpoint-walk',
    state: 'reachable',
  },
} as const

async function pairedGroup(): Promise<string> {
  const environment = await environmentActions.add({
    baseUrl: LAN,
    nickname: 'studio',
    token: 'pc_client_test',
  })
  await environmentActions.addEndpoint(environment.id, FUNNEL)
  await environmentActions.setActive(environment.id)
  environmentActions.setConnection(ready)
  return environment.id
}

/**
 * Query blips are not outages: React Query fails a request for reasons a walk would not
 * reproduce, so the panel only goes offline on the second consecutive failure. The walk itself
 * has no hysteresis — that lives in the shared `createSessionHealth` outcome instead.
 */
describe('query-blip hysteresis', () => {
  beforeEach(() => {
    nextId = 0
    environmentsStore.setState({
      activeId: null,
      connection: { kind: 'loading' },
      corrupt: false,
      environments: [],
    })
  })

  it('stays ready through the first failing query and goes unreachable on the second', async () => {
    const id = await pairedGroup()

    recordReachabilityFailure(id, 'The daemon could not be reached.')

    const first = currentConnection()
    expect(first.kind).toBe('ready')
    if (first.kind === 'ready') {
      expect(first.reachability.consecutiveFailures).toBe(1)
      expect(first.reachability.source).toBe('query')
    }

    recordReachabilityFailure(id, 'The daemon could not be reached.')

    const second = currentConnection()
    expect(second.kind).toBe('unreachable')
    if (second.kind === 'unreachable') {
      expect(second.reachability.consecutiveFailures).toBe(2)
      expect(second.reachability.source).toBe('query')
      // Routes come from the shared REM-003 order, not a second walk order.
      expect(second.reachability.attempted.map((attempt) => attempt.url)).toEqual([LAN, FUNNEL])
    }
  })

  it('clears the failure count once a query succeeds again', async () => {
    const id = await pairedGroup()

    recordReachabilityFailure(id, 'The daemon could not be reached.')
    recordReachabilitySuccess(id)

    const connection = currentConnection()
    expect(connection.kind).toBe('ready')
    if (connection.kind === 'ready') {
      expect(connection.reachability.consecutiveFailures).toBe(0)
    }
  })

  it('ignores reachability reports for an environment that is not the active one', async () => {
    await pairedGroup()

    recordReachabilityFailure('env-not-active', 'The daemon could not be reached.')
    recordReachabilityFailure('env-not-active', 'The daemon could not be reached.')

    expect(currentConnection().kind).toBe('ready')
  })
})
