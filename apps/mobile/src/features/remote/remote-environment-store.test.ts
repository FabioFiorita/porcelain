import { beforeEach, describe, expect, it, vi } from 'vitest'

// Secure Store and expo-crypto exist only in a native runtime; this suite runs under
// Vitest/jsdom like every other mobile pure-module test, so fakes stand in and the real
// store logic under test still runs unmodified.
let nextId = 0
vi.mock('expo-crypto', () => ({
  randomUUID: (): string => `env-${++nextId}`,
}))

const deleteItemAsync = vi.fn(async (_key: string): Promise<void> => {})
const getItemAsync = vi.fn(async (_key: string): Promise<string | null> => null)
const setItemAsync = vi.fn(async (_key: string, _value: string): Promise<void> => {})

vi.mock('expo-secure-store', () => ({
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
}))

vi.mock('@/lib/daemon/client', () => ({
  forgetDaemonClient: vi.fn(),
}))

const { environmentActions, environmentsStore } = await import('./remote-environment-store')

const INDEX_KEY = 'porcelain.environments'
const CORRUPT_KEY = 'porcelain.environments.corrupt'
const LAN = 'http://192.168.1.50:43117'

const V3_BLOB = JSON.stringify({
  version: 3,
  activeId: 'legacy-1',
  environments: [
    {
      id: 'legacy-1',
      nickname: 'studio',
      icon: 'box',
      baseUrl: LAN,
      endpoints: [LAN],
      preferredEndpoint: LAN,
      createdAt: 1_700_000_000_000,
      activeRepoPath: null,
    },
  ],
})

function indexWrites(): string[] {
  return setItemAsync.mock.calls.filter(([key]) => key === INDEX_KEY).map(([, value]) => value)
}

describe('remote environment store persistence', () => {
  beforeEach(() => {
    nextId = 0
    deleteItemAsync.mockClear()
    getItemAsync.mockClear()
    getItemAsync.mockResolvedValue(null)
    setItemAsync.mockClear()
    environmentsStore.setState({
      activeId: null,
      connection: { kind: 'loading' },
      corrupt: false,
      environments: [],
    })
  })

  it('writes a strict version-1 index and stamps the create-time default icon', async () => {
    const environment = await environmentActions.add({
      baseUrl: LAN,
      nickname: 'studio',
      token: 'pc_client_test',
    })

    expect(environment.icon).toBe('desktop')
    const written = indexWrites().at(-1)
    if (written === undefined) throw new Error('the index was never written')
    const file: unknown = JSON.parse(written)
    expect(file).toMatchObject({ version: 1, activeId: environment.id })
    expect(environment.enabled).toBe(true)
    expect(file).toMatchObject({ environments: [{ id: environment.id, enabled: true }] })
    expect(written).not.toContain('"version":3')
    // The token rides its own key; the index must never carry a credential.
    expect(written).not.toContain('pc_client_test')
    expect(setItemAsync).toHaveBeenCalledWith(`porcelain.token.${environment.id}`, 'pc_client_test')
  })

  it('keeps an unreadable index and its tokens instead of silently deleting them', async () => {
    getItemAsync.mockResolvedValue(V3_BLOB)

    await environmentActions.hydrate()

    expect(setItemAsync).toHaveBeenCalledWith(CORRUPT_KEY, V3_BLOB)
    expect(deleteItemAsync).not.toHaveBeenCalled()
    expect(indexWrites()).toEqual([])
    const state = environmentsStore.getState()
    expect(state.corrupt).toBe(true)
    expect(state.connection).toEqual({ kind: 'no-environment' })
    expect(state.environments).toEqual([])
  })

  it('reads a device that never paired as empty rather than corrupt', async () => {
    getItemAsync.mockResolvedValue(null)

    await environmentActions.hydrate()

    expect(environmentsStore.getState().corrupt).toBe(false)
    expect(setItemAsync).not.toHaveBeenCalledWith(CORRUPT_KEY, expect.anything())
  })

  it('hydrates a version-1 index and resolves each token from its own key', async () => {
    const id = 'env-stored-1'
    getItemAsync.mockImplementation(async (key: string): Promise<string | null> => {
      if (key === INDEX_KEY) {
        return JSON.stringify({
          version: 1,
          activeId: id,
          environments: [
            {
              id,
              nickname: 'studio',
              icon: 'terminal',
              baseUrl: LAN,
              endpoints: [LAN],
              preferredEndpoint: LAN,
              createdAt: 1_700_000_000_000,
              activeRepoPath: null,
            },
          ],
        })
      }
      return key === `porcelain.token.${id}` ? 'pc_client_stored' : null
    })

    await environmentActions.hydrate()

    const state = environmentsStore.getState()
    expect(state.corrupt).toBe(false)
    expect(state.activeId).toBe(id)
    expect(state.environments[0]).toMatchObject({
      enabled: true,
      icon: 'terminal',
      token: 'pc_client_stored',
    })
    expect(state.connection).toEqual({ kind: 'connecting' })
  })

  it('disables the current environment and selects the first enabled peer', async () => {
    const current = await environmentActions.add({
      baseUrl: LAN,
      nickname: 'studio',
      token: 'pc_client_studio',
    })
    const peer = await environmentActions.add({
      baseUrl: 'http://192.168.1.51:43117',
      nickname: 'office',
      token: 'pc_client_office',
    })

    await environmentActions.setEnabled(current.id, false)

    const state = environmentsStore.getState()
    expect(state.activeId).toBe(peer.id)
    expect(state.environments.find((entry) => entry.id === current.id)?.enabled).toBe(false)
    expect(state.connection).toEqual({ kind: 'connecting' })
    expect(indexWrites().at(-1)).toContain('"enabled":false')
  })

  it('disables the only current environment and clears selection and connection', async () => {
    const current = await environmentActions.add({
      baseUrl: LAN,
      nickname: 'studio',
      token: 'pc_client_studio',
    })

    await environmentActions.setEnabled(current.id, false)

    expect(environmentsStore.getState().activeId).toBeNull()
    expect(environmentsStore.getState().connection).toEqual({ kind: 'no-environment' })
  })

  it('does not make a disabled environment current', async () => {
    const current = await environmentActions.add({
      baseUrl: LAN,
      nickname: 'studio',
      token: 'pc_client_studio',
    })
    const peer = await environmentActions.add({
      baseUrl: 'http://192.168.1.51:43117',
      nickname: 'office',
      token: 'pc_client_office',
    })
    await environmentActions.setEnabled(current.id, false)

    await environmentActions.setActive(current.id)

    expect(environmentsStore.getState().activeId).toBe(peer.id)
  })

  it('hydrates a disabled environment as disabled and leaves it out of current selection', async () => {
    const id = 'env-disabled'
    getItemAsync.mockImplementation(async (key: string): Promise<string | null> => {
      if (key === INDEX_KEY) {
        return JSON.stringify({
          version: 1,
          activeId: id,
          environments: [
            {
              activeRepoPath: null,
              baseUrl: LAN,
              createdAt: 1_700_000_000_000,
              enabled: false,
              endpoints: [LAN],
              icon: 'desktop',
              id,
              nickname: 'studio',
              preferredEndpoint: LAN,
            },
          ],
        })
      }
      return key === `porcelain.token.${id}` ? 'pc_client_disabled' : null
    })

    await environmentActions.hydrate()

    const state = environmentsStore.getState()
    expect(state.environments[0]).toMatchObject({ enabled: false, token: 'pc_client_disabled' })
    expect(state.activeId).toBeNull()
    expect(state.connection).toEqual({ kind: 'no-environment' })
  })

  it('persists re-enabling and hydrates it as enabled', async () => {
    const current = await environmentActions.add({
      baseUrl: LAN,
      nickname: 'studio',
      token: 'pc_client_studio',
    })
    await environmentActions.setEnabled(current.id, false)
    await environmentActions.setEnabled(current.id, true)

    const written = indexWrites().at(-1)
    if (written === undefined) throw new Error('the index was never written')
    getItemAsync.mockImplementation(async (key: string): Promise<string | null> => {
      if (key === INDEX_KEY) return written
      return key === `porcelain.token.${current.id}` ? 'pc_client_studio' : null
    })

    await environmentActions.hydrate()

    expect(environmentsStore.getState().environments[0]?.enabled).toBe(true)
  })
})
