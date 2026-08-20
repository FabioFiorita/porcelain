import { PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RemoteEnvironmentState } from './remote-daemon'

/**
 * Naming an Environment the calling window is NOT bound to.
 *
 * The whole point of the feature is telling apart two daemons that answer with the same
 * machine name, so the risk this pins is attribution: the rename reaching the wrong daemon,
 * or the saved group name drifting from what its daemon actually settled on.
 */
vi.mock('electron', () => ({
  app: { getPath: (): string => '/tmp/porcelain-shell-environment-name-test' },
}))

const LOCAL_URL = 'http://127.0.0.1:43118'
const REMOTE_URL = 'http://beelink.local:43117'

let localPair: { url: string; token: string } = { url: LOCAL_URL, token: 'pc_admin_local' }
const reloadEnvironmentsCache = vi.fn(async () => state)

vi.mock('./daemon', () => ({
  localDaemonPair: (): { url: string; token: string } => localPair,
  reloadEnvironmentsCache: (): Promise<RemoteEnvironmentState> => reloadEnvironmentsCache(),
  setWindowRemoteEndpoint: (): void => undefined,
}))

let state: RemoteEnvironmentState = { activeId: null, environments: [] }

vi.mock('./remote-daemon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./remote-daemon')>()
  return {
    ...actual,
    loadRemoteEnvironmentState: async (): Promise<RemoteEnvironmentState> => state,
    updateRemoteEnvironmentState: async (
      update: (current: RemoteEnvironmentState) => RemoteEnvironmentState,
    ): Promise<void> => {
      state = update(state)
    },
  }
})

const { renameEnvironment } = await import('./shell-environment-name')

const DAEMON_INFO = {
  result: { data: { version: '1.2.3', host: 'fabio-pc', platform: 'linux', arch: 'x64' } },
}

/** What the daemon answers a rename with: the name it actually settled on. */
let settledName = 'Beelink (work)'

function stubDaemons(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('asleep.local')) throw new Error('ECONNREFUSED')
      if (url.endsWith('/trpc/renameEnvironment')) {
        return new Response(
          JSON.stringify({
            result: {
              data: {
                id: 'env-identity',
                name: settledName,
                host: 'fabio-pc',
                platform: 'linux',
                arch: 'x64',
              },
            },
          }),
          { status: 200 },
        )
      }
      if (url.endsWith('/trpc/environmentIdentity')) return new Response('', { status: 404 })
      return new Response(JSON.stringify(DAEMON_INFO), { status: 200 })
    }),
  )
}

beforeEach(() => {
  settledName = 'Beelink (work)'
  localPair = { url: LOCAL_URL, token: 'pc_admin_local' }
  state = {
    activeId: null,
    environments: [
      {
        id: 'env-remote',
        name: 'fabio-pc',
        url: REMOTE_URL,
        token: 'pc_client_remote',
        endpoints: [REMOTE_URL],
        preferredEndpoint: REMOTE_URL,
      },
    ],
  }
  reloadEnvironmentsCache.mockClear()
  stubDaemons()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renameCall(): { url: string; init: RequestInit | undefined } {
  const call = vi
    .mocked(fetch)
    .mock.calls.find(([input]) => String(input).endsWith('/trpc/renameEnvironment'))
  if (call === undefined) throw new Error('no rename request was made')
  return { url: String(call[0]), init: call[1] }
}

describe('renameEnvironment', () => {
  it('writes the nickname on the named remote daemon, with that group credential', async () => {
    const result = await renameEnvironment({ environmentId: 'env-remote', name: 'Beelink (work)' })

    const { url, init } = renameCall()
    expect(url).toBe(`${REMOTE_URL}/trpc/renameEnvironment`)
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer pc_client_remote')
    expect(headers.get(PROTOCOL_VERSION_HEADER)).not.toBeNull()
    expect(result).toEqual({ environmentId: 'env-remote', name: 'Beelink (work)' })
  })

  it('refreshes the saved group name so the picker stops showing the machine name', async () => {
    await renameEnvironment({ environmentId: 'env-remote', name: 'Beelink (work)' })

    expect(state.environments[0]?.name).toBe('Beelink (work)')
    expect(reloadEnvironmentsCache).toHaveBeenCalled()
  })

  it('records the name the DAEMON settled on, not the one that was typed', async () => {
    // Clearing: the daemon answers with its machine-derived name, and that is what is saved.
    settledName = 'fabio-pc'
    const result = await renameEnvironment({ environmentId: 'env-remote', name: '   ' })

    expect(result.name).toBe('fabio-pc')
    expect(state.environments[0]?.name).toBe('fabio-pc')
  })

  it('routes a null id to the local child daemon and leaves saved groups alone', async () => {
    await renameEnvironment({ environmentId: null, name: 'Studio' })

    expect(renameCall().url).toBe(`${LOCAL_URL}/trpc/renameEnvironment`)
    expect(state.environments[0]?.name).toBe('fabio-pc')
  })

  it('refuses rather than guessing when the Environment is gone', async () => {
    await expect(renameEnvironment({ environmentId: 'env-ghost', name: 'x' })).rejects.toThrow(
      'no longer connected',
    )
  })

  it('refuses when no endpoint of the group answers', async () => {
    state = {
      activeId: null,
      environments: [
        {
          id: 'env-remote',
          name: 'fabio-pc',
          url: 'http://asleep.local:43117',
          token: 'pc_client_remote',
          endpoints: ['http://asleep.local:43117'],
          preferredEndpoint: 'http://asleep.local:43117',
        },
      ],
    }

    await expect(
      renameEnvironment({ environmentId: 'env-remote', name: 'Beelink' }),
    ).rejects.toThrow('not reachable')
  })

  it('refuses when the local daemon is not running', async () => {
    localPair = { url: '', token: '' }

    await expect(renameEnvironment({ environmentId: null, name: 'Studio' })).rejects.toThrow(
      'local daemon is not running',
    )
  })
})
