import { beforeEach, describe, expect, it } from 'vitest'
import {
  browserEnvironmentConnections,
  ensureEnvironmentSession,
  environmentSessionFor,
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
})
