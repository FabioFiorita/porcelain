import { beforeEach, describe, expect, it, vi } from 'vitest'

let nextId = 0
vi.mock('expo-crypto', () => ({
  randomUUID: (): string => `env-${++nextId}`,
}))

const deleteItemAsync = vi.fn(async (_key: string): Promise<void> => {})
const getItemAsync = vi.fn(async (_key: string): Promise<null> => null)
const setItemAsync = vi.fn(async (_key: string, _value: string): Promise<void> => {})

vi.mock('expo-secure-store', () => ({
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
}))

vi.mock('@/lib/daemon/client', () => ({
  forgetDaemonClient: vi.fn(),
}))

vi.mock('@/lib/daemon/session', () => ({
  configureSession: vi.fn(),
}))

const { environmentActions, environmentsStore, getEnvironment } = await import(
  './remote-environment-store'
)
const { currentConnection } = await import('./remote-connection')
const { goUnauthorized } = await import('./remote-unauthorized')
const { configureSession } = await import('@/lib/daemon/session')

const LAN = 'http://192.168.1.50:43117'

describe('goUnauthorized revoked-session cleanup', () => {
  beforeEach(() => {
    nextId = 0
    deleteItemAsync.mockReset()
    deleteItemAsync.mockResolvedValue(undefined)
    getItemAsync.mockReset()
    getItemAsync.mockResolvedValue(null)
    setItemAsync.mockReset()
    setItemAsync.mockResolvedValue(undefined)
    environmentsStore.setState({
      activeId: null,
      connection: { kind: 'loading' },
      corrupt: false,
      environments: [],
    })
  })

  it('reaches unauthorized even when secure-store token deletion rejects', async () => {
    const environment = await environmentActions.add({
      baseUrl: LAN,
      nickname: 'studio',
      token: 'pc_client_test',
    })
    await environmentActions.setActive(environment.id)
    environmentActions.setConnection({
      daemonVersion: '1.0.0',
      kind: 'ready',
      reachability: {
        attempted: [],
        consecutiveFailures: 0,
        source: 'endpoint-walk',
        state: 'reachable',
      },
    })

    deleteItemAsync.mockRejectedValueOnce(new Error('secure store locked'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await goUnauthorized(getEnvironment(environment.id) ?? environment)

    expect(configureSession).toHaveBeenCalledWith(null)
    const connection = currentConnection()
    expect(connection.kind).toBe('unauthorized')
    if (connection.kind === 'unauthorized') {
      expect(connection.cleanupError).toBe('secure store locked')
    }
    // In-memory credential is gone even though disk delete failed.
    expect(getEnvironment(environment.id)?.token).toBeNull()
    // Operator channel: cleanup failure must be visible, not only stored on state.
    expect(errorSpy).toHaveBeenCalled()
    expect(String(errorSpy.mock.calls[0]?.[0])).toMatch(/token delete failed after revoke/)
    errorSpy.mockRestore()
  })

  it('unauthorized without cleanupError when deletion succeeds', async () => {
    const environment = await environmentActions.add({
      baseUrl: 'http://100.64.0.1:43117',
      nickname: 'other',
      token: 'pc_ok',
    })

    await goUnauthorized(getEnvironment(environment.id) ?? environment)

    expect(currentConnection()).toEqual({ kind: 'unauthorized' })
  })
})
