import { beforeEach, describe, expect, it } from 'vitest'
import {
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
})
