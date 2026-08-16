import { beforeEach, describe, expect, it, vi } from 'vitest'
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
} from './environment-sessions'

beforeEach(() => {
  window.localStorage.clear()
  setPrimaryEnvironmentId(null)
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
              protocolVersion: 1,
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
