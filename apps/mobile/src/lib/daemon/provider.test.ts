import { beforeEach, describe, expect, it, vi } from 'vitest'

// `environments-store.ts` reaches into SecureStore and expo-crypto to persist and mint ids —
// neither exists outside a native runtime, and this suite runs under Vitest/jsdom like every
// other mobile pure-module test (see `apps/desktop/vitest.config.ts`). Fakes stand in so the
// real store/reducer logic under test still runs, unmodified.
let nextId = 0
vi.mock('expo-crypto', () => ({
  randomUUID: (): string => `env-${++nextId}`,
}))
vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(async (): Promise<void> => {}),
  getItemAsync: vi.fn(async (): Promise<null> => null),
  setItemAsync: vi.fn(async (): Promise<void> => {}),
}))

// `provider.tsx` wires React Query's focus/online managers to real RN/Expo listeners at import
// time. The listener bodies never run in this suite (no test flips app-state or network state),
// so a no-op subscription is all either needs.
vi.mock('expo-network', () => ({
  addNetworkStateListener: vi.fn(() => ({ remove: vi.fn() })),
}))
vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}))

// The daemon seam itself is not under test here — only the endpoint-walk decision that sits in
// front of it. `createDaemonClient` becomes an identity tag and `callDaemon` looks the tag up in
// a small "which URLs answer right now" set the tests drive directly. `PROBE_TIMEOUT_MS` stays
// the real export so a test below can prove bootstrap actually asks for the probe budget.
vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return {
    ...actual,
    createDaemonClient: vi.fn((baseUrl: string, token: string) => ({ baseUrl, token })),
  }
})

const reachable = new Set<string>()

vi.mock('./procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./procedure')>()
  return {
    ...actual,
    callDaemon: vi.fn(
      async (
        client: { baseUrl: string },
        procedure: { name: string },
      ): Promise<{ version: string } | unknown[]> => {
        if (!reachable.has(client.baseUrl)) {
          const { DaemonError } = await import('./errors')
          throw new DaemonError('unreachable', procedure.name, 'The daemon could not be reached.')
        }
        return procedure.name === 'daemonInfo' ? { version: '1.2.3' } : []
      },
    ),
  }
})

const { environmentActions, getEnvironment, currentConnection } = await import(
  './environments-store'
)
const { retryConnection, recoverToPreferredEndpoint } = await import('./provider')
const { createDaemonClient, PROBE_TIMEOUT_MS } = await import('./client')

const LAN = 'http://192.168.1.50:43117'
const FUNNEL = 'https://beelink.example.ts.net'

async function pairGroup(): Promise<string> {
  const environment = await environmentActions.add({
    baseUrl: LAN,
    nickname: 'beelink',
    token: 'pc_client_test',
  })
  await environmentActions.addEndpoint(environment.id, FUNNEL)
  await environmentActions.setActive(environment.id)
  return environment.id
}

describe('automatic endpoint failover', () => {
  beforeEach(() => {
    reachable.clear()
  })

  it('walks to the next known endpoint and makes it active when the current one is unreachable', async () => {
    const id = await pairGroup()
    reachable.add(FUNNEL) // LAN stays unreachable — only Funnel answers.

    await retryConnection()

    expect(getEnvironment(id)?.baseUrl).toBe(FUNNEL)
    expect(currentConnection()).toMatchObject({ kind: 'ready' })
  })

  // The bootstrap probe must ask for the short, connect-failure budget — never the large one
  // regular app traffic gets — or a dead LAN endpoint would hang the whole walk instead of
  // failing over quickly. See `PROBE_TIMEOUT_MS` in `client.ts`.
  it('probes every endpoint in the walk with the connect-failure budget, not the traffic one', async () => {
    await pairGroup()
    reachable.add(LAN)

    await retryConnection()

    expect(createDaemonClient).toHaveBeenCalledWith(LAN, 'pc_client_test', {
      timeoutMs: PROBE_TIMEOUT_MS,
    })
  })

  it('does not move off the preferred endpoint while it is still the one answering', async () => {
    const id = await pairGroup()
    reachable.add(LAN)
    reachable.add(FUNNEL)

    await retryConnection()

    expect(getEnvironment(id)?.baseUrl).toBe(LAN)
  })

  it('climbs back to the preferred endpoint once it is reachable again', async () => {
    const id = await pairGroup()
    reachable.add(FUNNEL)
    await retryConnection()
    expect(getEnvironment(id)?.baseUrl).toBe(FUNNEL) // Failed over, as proven above.

    reachable.add(LAN) // The home network is back.
    await recoverToPreferredEndpoint()

    expect(getEnvironment(id)?.baseUrl).toBe(LAN)
    expect(currentConnection()).toMatchObject({ kind: 'ready' })
  })

  it('does not recover while still parked on the endpoint the user explicitly picked', async () => {
    const id = await pairGroup()
    reachable.add(LAN)
    reachable.add(FUNNEL)
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
    reachable.add(LAN)
    reachable.add(FUNNEL)
    await retryConnection()
    expect(getEnvironment(id)?.baseUrl).toBe(LAN)

    // The user re-points their preference at Funnel while LAN is still perfectly reachable.
    await environmentActions.preferEndpoint(id, FUNNEL)
    await retryConnection()

    expect(getEnvironment(id)?.baseUrl).toBe(FUNNEL)
  })
})
