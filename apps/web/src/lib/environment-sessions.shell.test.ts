import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Electron half of the session registry. Its own file because `isBrowser` is a
 * module-level const: a shell window and a browser tab cannot both be true in one module
 * graph, and mocking it here keeps the browser suite reading the real flag.
 */
vi.mock('./platform', () => ({ isBrowser: false }))

const {
  environmentConnections,
  environmentSessionFor,
  liveEnvironmentSessions,
  registerEnvironmentAlias,
  setShellEnvironmentConnections,
  shellConnectionId,
} = await import('./environment-sessions')

const connection = {
  id: 'env-beelink',
  name: 'beelink soap',
  url: 'http://127.0.0.1:43220',
  token: 'pc_client_beelink_secret',
}

beforeEach(() => {
  setShellEnvironmentConnections([])
})

describe('shell Environment connections', () => {
  it('names This device with a string id the registry can key on', () => {
    expect(shellConnectionId(null)).toBe('this-device')
    expect(shellConnectionId('env-beelink')).toBe('env-beelink')
  })

  it('ignores localStorage and reads what the shell handed over', () => {
    window.localStorage.setItem(
      'porcelain-browser-environments',
      JSON.stringify([{ ...connection, id: 'from-storage' }]),
    )
    setShellEnvironmentConnections([connection])

    expect(environmentConnections().map((entry) => entry.id)).toEqual(['env-beelink'])
  })

  it('resolves a daemon-announced Environment id once the Hub aliases it', () => {
    setShellEnvironmentConnections([connection])
    expect(environmentSessionFor('uuid-beelink')).toBeNull()

    registerEnvironmentAlias('uuid-beelink', connection.id)

    expect(environmentSessionFor('uuid-beelink')?.name).toBe('beelink soap')
  })

  it('opens nothing until something addresses the Environment', () => {
    setShellEnvironmentConnections([connection])

    // Handing the list over must not cost a socket per saved machine; the session is
    // created on the first resolve.
    expect(liveEnvironmentSessions()).toHaveLength(2)
    expect(environmentSessionFor(connection.id)).not.toBeNull()
  })

  it('re-points a moved Environment instead of rebuilding its live session', () => {
    setShellEnvironmentConnections([connection])
    const session = environmentSessionFor(connection.id)?.session
    expect(session).toBeDefined()
    if (session === undefined) return
    const stop = vi.spyOn(session, 'stop')

    setShellEnvironmentConnections([{ ...connection, url: 'http://tailnet.example:43220' }])

    // A rebuild would drop every PTY attached to it, and the query behind this refetches
    // on focus.
    expect(stop).not.toHaveBeenCalled()
    expect(environmentSessionFor(connection.id)?.session).toBe(session)
    expect(session.endpoint().url).toBe('http://tailnet.example:43220')
  })

  it('stops and forgets a session when its Environment drops off the list', () => {
    setShellEnvironmentConnections([connection])
    const session = environmentSessionFor(connection.id)?.session
    expect(session).toBeDefined()
    if (session === undefined) return
    const stop = vi.spyOn(session, 'stop')

    setShellEnvironmentConnections([])

    expect(stop).toHaveBeenCalledOnce()
    expect(environmentSessionFor(connection.id)).toBeNull()
  })
})
