import { describe, expect, it } from 'vitest'
import {
  activeRemoteDaemon,
  endpointKind,
  normalizeDaemonUrl,
  orderedEndpoints,
  parseRemoteEnvironmentState,
  type RemoteEnvironment,
  withActiveUrl,
  withEndpoint,
  withoutEndpoint,
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
  it('passes a valid environment-group state straight through', () => {
    const state = {
      activeId: 'a',
      environments: [
        {
          endpoints: ['http://beelink:43117'],
          id: 'a',
          name: 'Beelink',
          preferredEndpoint: 'http://beelink:43117',
          token: 't1',
          url: 'http://beelink:43117',
        },
        {
          endpoints: ['https://mac.ts.net'],
          id: 'b',
          name: 'Mac',
          preferredEndpoint: 'https://mac.ts.net',
          token: 't2',
          url: 'https://mac.ts.net',
        },
      ],
    }
    expect(parseRemoteEnvironmentState(state)).toEqual(state)
  })

  it('returns the empty state for garbage, null, or single-url shapes', () => {
    const empty = { activeId: null, environments: [] }
    expect(parseRemoteEnvironmentState(null)).toEqual(empty)
    expect(parseRemoteEnvironmentState({ nope: true })).toEqual(empty)
    expect(parseRemoteEnvironmentState('string')).toEqual(empty)
    // A group must declare its endpoint list; re-pair a single-url record.
    expect(
      parseRemoteEnvironmentState({
        url: 'http://beelink.tailnet.ts.net:43117',
        token: 'secret',
      }),
    ).toEqual(empty)
  })
})

describe('activeRemoteDaemon', () => {
  it('resolves the active environment to its url+token pair', () => {
    const state = {
      activeId: 'b',
      environments: [
        {
          endpoints: ['http://beelink:43117'],
          id: 'a',
          name: 'Beelink',
          preferredEndpoint: 'http://beelink:43117',
          token: 't1',
          url: 'http://beelink:43117',
        },
        {
          endpoints: ['https://mac.ts.net'],
          id: 'b',
          name: 'Mac',
          preferredEndpoint: 'https://mac.ts.net',
          token: 't2',
          url: 'https://mac.ts.net',
        },
      ],
    }
    expect(activeRemoteDaemon(state)).toEqual({ url: 'https://mac.ts.net', token: 't2' })
  })

  it('returns null when nothing is active', () => {
    const state = {
      activeId: null,
      environments: [
        {
          endpoints: ['http://beelink:43117'],
          id: 'a',
          name: 'Beelink',
          preferredEndpoint: 'http://beelink:43117',
          token: 't1',
          url: 'http://beelink:43117',
        },
      ],
    }
    expect(activeRemoteDaemon(state)).toBeNull()
  })

  it('returns null when activeId dangles', () => {
    const state = {
      activeId: 'gone',
      environments: [
        {
          endpoints: ['http://beelink:43117'],
          id: 'a',
          name: 'Beelink',
          preferredEndpoint: 'http://beelink:43117',
          token: 't1',
          url: 'http://beelink:43117',
        },
      ],
    }
    expect(activeRemoteDaemon(state)).toBeNull()
  })
})

const LAN = 'http://192.168.1.50:43117'
const TAILNET = 'http://100.94.12.3:43117'
const NAMED = 'http://beelink:43117'

const env = (overrides: Partial<RemoteEnvironment> = {}): RemoteEnvironment => ({
  id: 'e1',
  name: 'Beelink',
  url: LAN,
  token: 't',
  endpoints: [LAN, TAILNET],
  preferredEndpoint: LAN,
  ...overrides,
})

describe('endpointKind', () => {
  it('recognizes the tailnet CGNAT range and the RFC1918 ranges', () => {
    expect(endpointKind(TAILNET)).toBe('tailnet')
    expect(endpointKind(LAN)).toBe('lan')
    expect(endpointKind('http://10.0.0.4:43117')).toBe('lan')
    expect(endpointKind('http://172.20.0.4:43117')).toBe('lan')
  })

  it('does not mistake neighbours of 100.64/10 for the tailnet', () => {
    expect(endpointKind('http://100.63.0.1:43117')).toBe('other')
    expect(endpointKind('http://100.128.0.1:43117')).toBe('other')
    // 172.32 is outside 172.16/12 — a classic off-by-one in private-range checks.
    expect(endpointKind('http://172.32.0.1:43117')).toBe('other')
  })

  it('recognizes local and direct MagicDNS hostnames without guessing public HTTPS', () => {
    expect(endpointKind(NAMED)).toBe('other')
    expect(endpointKind('http://beelink.local:43117')).toBe('lan')
    expect(endpointKind('http://beelink.ts.net:43117')).toBe('tailnet')
    expect(endpointKind('https://beelink.ts.net:43117')).toBe('other')
    expect(endpointKind('not a url')).toBe('other')
  })
})

describe('orderedEndpoints', () => {
  it('tries the exact preferred endpoint first, not every endpoint of its kind', () => {
    expect(orderedEndpoints(env({ url: TAILNET, preferredEndpoint: LAN }))).toEqual([LAN, TAILNET])
  })

  it('falls back to the last known good url when the preferred route is stale', () => {
    expect(
      orderedEndpoints(env({ preferredEndpoint: 'http://old-route:43117', url: TAILNET })),
    ).toEqual([TAILNET, LAN])
  })

  it('never yields an address the environment no longer knows', () => {
    const stale = env({ url: 'http://192.168.9.9:43117', endpoints: [TAILNET] })
    expect(orderedEndpoints(stale)).toEqual([TAILNET])
  })
})

describe('endpoint edits', () => {
  it('adds an address once', () => {
    expect(withEndpoint(env(), TAILNET).endpoints).toEqual([LAN, TAILNET])
    expect(withEndpoint(env(), NAMED).endpoints).toEqual([LAN, TAILNET, NAMED])
  })

  it('records the live address WITHOUT moving the preference — reachability is not a choice', () => {
    const moved = withActiveUrl(env({ preferredEndpoint: LAN }), TAILNET)
    expect(moved.url).toBe(TAILNET)
    expect(moved.preferredEndpoint).toBe(LAN)
  })

  it('adds an unknown live address to the list rather than dangling', () => {
    expect(withActiveUrl(env({ endpoints: [LAN] }), TAILNET).endpoints).toEqual([LAN, TAILNET])
  })

  it('removes an address and re-points the url when it was the active one', () => {
    const dropped = withoutEndpoint(env({ url: LAN }), LAN)
    expect(dropped.endpoints).toEqual([TAILNET])
    expect(dropped.url).toBe(TAILNET)
  })

  it('selects a remaining endpoint when the primary route is removed', () => {
    expect(withoutEndpoint(env({ preferredEndpoint: LAN }), LAN).preferredEndpoint).toBe(TAILNET)
  })

  it('refuses to remove the last way in', () => {
    const only = env({ endpoints: [LAN] })
    expect(withoutEndpoint(only, LAN)).toEqual(only)
  })
})
