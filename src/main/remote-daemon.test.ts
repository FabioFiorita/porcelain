import { describe, expect, it } from 'vitest'
import {
  activeRemoteDaemon,
  normalizeDaemonUrl,
  parseRemoteEnvironmentState,
} from './remote-daemon'

describe('normalizeDaemonUrl', () => {
  it('accepts http and https urls', () => {
    expect(normalizeDaemonUrl('http://beelink:43117')).toBe('http://beelink:43117')
    expect(normalizeDaemonUrl('https://beelink.tailnet.ts.net')).toBe(
      'https://beelink.tailnet.ts.net',
    )
  })

  it('strips a trailing slash on the path', () => {
    expect(normalizeDaemonUrl('http://beelink:43117/')).toBe('http://beelink:43117')
    expect(normalizeDaemonUrl('http://beelink:43117/porcelain/')).toBe(
      'http://beelink:43117/porcelain',
    )
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeDaemonUrl('  http://beelink:43117  ')).toBe('http://beelink:43117')
  })

  it('rejects a url without an http(s) scheme', () => {
    expect(() => normalizeDaemonUrl('beelink:43117')).toThrow(/http:\/\/ or https:\/\//)
    expect(() => normalizeDaemonUrl('ws://beelink:43117')).toThrow(/http:\/\/ or https:\/\//)
    expect(() => normalizeDaemonUrl('')).toThrow(/http:\/\/ or https:\/\//)
  })
})

describe('parseRemoteEnvironmentState', () => {
  it('passes a valid v2 state straight through', () => {
    const state = {
      activeId: 'a',
      environments: [
        { id: 'a', name: 'Beelink', url: 'http://beelink:43117', token: 't1' },
        { id: 'b', name: 'Mac', url: 'https://mac.ts.net', token: 't2' },
      ],
    }
    expect(parseRemoteEnvironmentState(state)).toEqual(state)
  })

  it('migrates a legacy override to one active environment named by hostname', () => {
    const legacy = { url: 'http://beelink.tailnet.ts.net:43117', token: 'secret' }
    expect(parseRemoteEnvironmentState(legacy)).toEqual({
      activeId: 'legacy',
      environments: [
        {
          id: 'legacy',
          name: 'beelink.tailnet.ts.net',
          url: 'http://beelink.tailnet.ts.net:43117',
          token: 'secret',
        },
      ],
    })
  })

  it('falls back to the raw url when the legacy url is not parseable', () => {
    const legacy = { url: 'beelink', token: 'secret' }
    expect(parseRemoteEnvironmentState(legacy)).toEqual({
      activeId: 'legacy',
      environments: [{ id: 'legacy', name: 'beelink', url: 'beelink', token: 'secret' }],
    })
  })

  it('returns the empty state for garbage or null', () => {
    const empty = { activeId: null, environments: [] }
    expect(parseRemoteEnvironmentState(null)).toEqual(empty)
    expect(parseRemoteEnvironmentState({ nope: true })).toEqual(empty)
    expect(parseRemoteEnvironmentState('string')).toEqual(empty)
  })
})

describe('activeRemoteDaemon', () => {
  it('resolves the active environment to its url+token pair', () => {
    const state = {
      activeId: 'b',
      environments: [
        { id: 'a', name: 'Beelink', url: 'http://beelink:43117', token: 't1' },
        { id: 'b', name: 'Mac', url: 'https://mac.ts.net', token: 't2' },
      ],
    }
    expect(activeRemoteDaemon(state)).toEqual({ url: 'https://mac.ts.net', token: 't2' })
  })

  it('returns null when nothing is active', () => {
    const state = {
      activeId: null,
      environments: [{ id: 'a', name: 'Beelink', url: 'http://beelink:43117', token: 't1' }],
    }
    expect(activeRemoteDaemon(state)).toBeNull()
  })

  it('returns null when activeId dangles', () => {
    const state = {
      activeId: 'gone',
      environments: [{ id: 'a', name: 'Beelink', url: 'http://beelink:43117', token: 't1' }],
    }
    expect(activeRemoteDaemon(state)).toBeNull()
  })
})
