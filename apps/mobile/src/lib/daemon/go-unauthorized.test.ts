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

vi.mock('expo-network', () => ({
  addNetworkStateListener: vi.fn(() => ({ remove: vi.fn() })),
}))
vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}))

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return {
    ...actual,
    createDaemonClient: vi.fn((baseUrl: string, token: string) => ({ baseUrl, token })),
    forgetDaemonClient: vi.fn(),
  }
})

vi.mock('./procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./procedure')>()
  return {
    ...actual,
    callDaemon: vi.fn(async () => ({ version: '1.0.0' })),
  }
})

vi.mock('./session', () => ({
  configureSession: vi.fn(),
  onSessionClosed: vi.fn(),
  setSessionForeground: vi.fn(),
  subscribeSessionChanges: vi.fn(() => () => undefined),
}))

const { environmentActions, currentConnection, getEnvironment } = await import(
  './environments-store'
)
const { goUnauthorized } = await import('./go-unauthorized')
const { configureSession } = await import('./session')

describe('goUnauthorized revoked-session cleanup', () => {
  beforeEach(() => {
    deleteItemAsync.mockReset()
    deleteItemAsync.mockResolvedValue(undefined)
    getItemAsync.mockReset()
    getItemAsync.mockResolvedValue(null)
    setItemAsync.mockReset()
    setItemAsync.mockResolvedValue(undefined)
    nextId = 0
  })

  it('reaches unauthorized even when secure-store token deletion rejects', async () => {
    const environment = await environmentActions.add({
      baseUrl: 'http://192.168.1.10:43118',
      nickname: 'beelink',
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
      baseUrl: 'http://192.168.1.11:43118',
      nickname: 'other',
      token: 'pc_ok',
    })
    await goUnauthorized(getEnvironment(environment.id) ?? environment)
    const connection = currentConnection()
    expect(connection).toEqual({ kind: 'unauthorized' })
  })
})
