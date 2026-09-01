import { PROTOCOL_VERSION } from '@porcelain/contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// isBrowser is `true` by default under vitest/jsdom (no preload bridge); the shell-connection
// tests below flip it to exercise activeEnvironmentConnections()'s Electron branch instead.
const platformState = vi.hoisted(() => ({ isBrowser: true }))
vi.mock('./platform', () => ({
  get isBrowser() {
    return platformState.isBrowser
  },
  isE2E: false,
  isLinuxShell: false,
}))

import {
  addBrowserEnvironmentConnection,
  browserEnvironmentConnections,
  daemonScopeForEnvironment,
  ensureEnvironmentSession,
  environmentSessionFor,
  liveEnvironmentSessions,
  registerEnvironmentAlias,
  setBrowserEnvironmentConnections,
  setPrimaryEnvironmentId,
  setShellEnvironmentConnections,
  shellEnvironmentConnections,
  thisDeviceClient,
} from './environment-sessions'

beforeEach(() => {
  window.localStorage.clear()
  setPrimaryEnvironmentId(null)
  platformState.isBrowser = true
  setShellEnvironmentConnections([])
})

describe('browser Environment session hub', () => {
  it('ignores malformed client-local connections', () => {
    window.localStorage.setItem(
      'porcelain-browser-environments',
      JSON.stringify([{ id: 'missing-token', name: 'Nope', url: 'http://127.0.0.1:1' }]),
    )

    expect(browserEnvironmentConnections()).toEqual([])
  })

  it('caches one session per Environment and resolves explicit targets', () => {
    const connection = {
      id: 'env-secondary',
      name: 'Secondary',
      url: 'http://127.0.0.1:43220',
      token: 'pc_client_secondary_secret',
    }
    setBrowserEnvironmentConnections([connection])

    const first = ensureEnvironmentSession(connection)
    const second = ensureEnvironmentSession(connection)

    expect(second).toBe(first)
    expect(environmentSessionFor('env-secondary')).toBe(first)
    expect(environmentSessionFor('offline')).toBeNull()
  })

  it('enumerates the serving daemon and every configured secondary session', () => {
    setPrimaryEnvironmentId('env-primary')
    setBrowserEnvironmentConnections([
      {
        id: 'env-secondary',
        name: 'Secondary',
        url: 'http://127.0.0.1:43220',
        token: 'pc_client_secondary_secret',
      },
    ])

    const sessions = liveEnvironmentSessions()
    expect(sessions.map((entry) => entry.connectionId)).toEqual([null, 'env-secondary'])
    expect(daemonScopeForEnvironment(null, { host: 'beelink', version: '0.52.1' })).toEqual({
      host: 'beelink',
      version: '0.52.1',
    })
    expect(
      daemonScopeForEnvironment('env-secondary', { host: 'beelink', version: '0.52.1' }),
    ).toEqual({
      host: 'env-secondary',
      version: '0.52.1',
    })
  })

  it('reactively adopts announced UUIDs and removes aliases with their connection', () => {
    const connection = {
      id: 'connection-secondary',
      name: 'Secondary',
      url: 'http://127.0.0.1:43220',
      token: 'pc_client_secondary_secret',
    }
    setBrowserEnvironmentConnections([connection])
    expect(liveEnvironmentSessions()[1]?.environmentId).toBe('connection-secondary')

    registerEnvironmentAlias('uuid-secondary', connection.id)
    expect(liveEnvironmentSessions()[1]?.environmentId).toBe('uuid-secondary')
    expect(environmentSessionFor('uuid-secondary')).not.toBeNull()

    setBrowserEnvironmentConnections([])
    expect(environmentSessionFor('uuid-secondary')).toBeNull()
    expect(liveEnvironmentSessions()).toHaveLength(1)
  })

  it('stops and removes a session when its browser connection is deleted', () => {
    const connection = {
      id: 'connection-secondary',
      name: 'Secondary',
      url: 'http://127.0.0.1:43220',
      token: 'pc_client_secondary_secret',
    }
    setBrowserEnvironmentConnections([connection])
    const session = ensureEnvironmentSession(connection).session
    const stop = vi.spyOn(session, 'stop')

    setBrowserEnvironmentConnections([])

    expect(stop).toHaveBeenCalledOnce()
    expect(environmentSessionFor(connection.id)).toBeNull()
  })

  it('rejects administrator credentials before any connection is persisted', async () => {
    await expect(
      addBrowserEnvironmentConnection({
        name: 'Host',
        url: 'http://127.0.0.1:43220',
        token: 'admin-secret',
      }),
    ).rejects.toThrow('paired client token')
    expect(browserEnvironmentConnections()).toEqual([])
  })

  it('verifies daemon identity before saving a browser connection', async () => {
    const response = new Response(
      JSON.stringify([
        {
          result: {
            data: {
              version: '0.52.1',
              protocolVersion: PROTOCOL_VERSION,
              host: 'secondary-box',
              platform: 'linux',
              arch: 'x64',
            },
          },
        },
      ]),
      { headers: { 'content-type': 'application/json' } },
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response.clone()),
    )

    await expect(
      addBrowserEnvironmentConnection({
        name: 'Secondary',
        url: 'http://127.0.0.1:43220/',
        token: 'pc_client_secondary_secret',
      }),
    ).resolves.toMatchObject({ host: 'secondary-box', platform: 'linux', version: '0.52.1' })

    const saved = browserEnvironmentConnections()
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({
      name: 'Secondary',
      url: 'http://127.0.0.1:43220',
      token: 'pc_client_secondary_secret',
    })
    vi.unstubAllGlobals()
  })
})

describe('shell Environment session hub', () => {
  it('resolves This device independently of a remote primary window', () => {
    platformState.isBrowser = false
    const local = {
      id: 'this-device',
      name: 'This device',
      url: 'http://127.0.0.1:43118',
      token: 'local-admin-token',
    }
    setShellEnvironmentConnections([local])
    const primaryClient = { marker: 'remote-primary' } as never

    const owner = thisDeviceClient(primaryClient)

    expect(owner.client).toBe(ensureEnvironmentSession(local).client)
    expect(owner.environmentId).toBe('this-device')
  })

  it('uses the primary client when this window already belongs to This device', () => {
    platformState.isBrowser = false
    const primaryClient = { marker: 'local-primary' } as never

    expect(thisDeviceClient(primaryClient)).toEqual({
      client: primaryClient,
      environmentId: null,
      session: null,
    })
  })

  it('caches one session per Environment and resolves explicit targets', () => {
    platformState.isBrowser = false
    const connection = {
      id: 'shell-secondary',
      name: 'Secondary',
      url: 'http://127.0.0.1:43221',
      token: 'pc_client_shell_secondary',
    }
    setShellEnvironmentConnections([connection])
    expect(shellEnvironmentConnections()).toEqual([connection])

    const first = ensureEnvironmentSession(connection)
    const second = ensureEnvironmentSession(connection)

    expect(second).toBe(first)
    expect(environmentSessionFor('shell-secondary')).toBe(first)
    expect(environmentSessionFor('offline')).toBeNull()
  })

  it('re-points an existing shell session in place when its connection is repointed', () => {
    platformState.isBrowser = false
    const connection = {
      id: 'shell-secondary',
      name: 'Secondary',
      url: 'http://127.0.0.1:43221',
      token: 'pc_client_shell_secondary',
    }
    setShellEnvironmentConnections([connection])
    const before = ensureEnvironmentSession(connection)

    const repointed = { ...connection, url: 'http://127.0.0.1:43222' }
    setShellEnvironmentConnections([repointed])
    const after = ensureEnvironmentSession(repointed)

    expect(after).toBe(before)
    expect(after.session.endpoint().url).toBe('http://127.0.0.1:43222')
  })

  it('stops and removes a session when its shell connection is pruned', () => {
    platformState.isBrowser = false
    const connection = {
      id: 'shell-secondary',
      name: 'Secondary',
      url: 'http://127.0.0.1:43221',
      token: 'pc_client_shell_secondary',
    }
    setShellEnvironmentConnections([connection])
    const session = ensureEnvironmentSession(connection).session
    const stop = vi.spyOn(session, 'stop')

    setShellEnvironmentConnections([])

    expect(stop).toHaveBeenCalledOnce()
    expect(shellEnvironmentConnections()).toEqual([])
    expect(environmentSessionFor(connection.id)).toBeNull()
  })

  it('keeps a shell-sourced session alive across repeated routing calls (regression)', () => {
    platformState.isBrowser = false
    const connection = {
      id: 'shell-secondary',
      name: 'Secondary',
      url: 'http://127.0.0.1:43221',
      token: 'pc_client_shell_secondary',
    }
    setShellEnvironmentConnections([connection])
    const session = ensureEnvironmentSession(connection).session
    const stop = vi.spyOn(session, 'stop')

    // Before the fix, browserEnvironmentConnections() re-parsed localStorage and pruned
    // on every read — including these internal calls from every routing decision — and
    // stopped any session outside ITS OWN (empty, localStorage-backed) id set. On
    // Electron that silently killed this shell-sourced session, live PTYs included, the
    // moment any routing call ran after it was created.
    environmentSessionFor(connection.id)
    liveEnvironmentSessions()
    environmentSessionFor(connection.id)
    liveEnvironmentSessions()

    expect(stop).not.toHaveBeenCalled()
    expect(shellEnvironmentConnections()).toEqual([connection])
    expect(environmentSessionFor(connection.id)).toBe(ensureEnvironmentSession(connection))
  })
})
