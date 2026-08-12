import { isRemoteRetryable, orderRemoteEndpoints } from '@porcelain/client-runtime/remote'
import { publicErrorFixtures } from '@porcelain/contracts'
import { sessionContractFixtures } from '@porcelain/contracts/session'
import { describe, expect, it } from 'vitest'
import { classifyRemoteFailure, mapAdapterStatus, orderWebRemoteEndpoints } from './remote-session'

const LAN = 'http://192.168.1.50:43117'
const TAILNET = 'http://100.64.0.1:43117'
const FUNNEL = 'https://beelink.example.ts.net'
const LOOPBACK = 'http://127.0.0.1:43117'

describe('orderWebRemoteEndpoints', () => {
  it('delegates to orderRemoteEndpoints: preferred, last-known-good, then rest', () => {
    const group = {
      endpoints: [LAN, TAILNET, FUNNEL],
      preferredEndpoint: FUNNEL,
      url: LAN,
    }
    expect(orderWebRemoteEndpoints(group)).toEqual(orderRemoteEndpoints(group))
    expect(orderWebRemoteEndpoints(group)).toEqual([FUNNEL, LAN, TAILNET])
  })

  it('drops a stale preferred address and does not rank by kind', () => {
    const stalePreferred = {
      endpoints: [LOOPBACK, TAILNET, LAN, FUNNEL],
      preferredEndpoint: 'http://192.168.9.9:43117',
      url: LAN,
    }
    expect(orderWebRemoteEndpoints(stalePreferred)).toEqual(orderRemoteEndpoints(stalePreferred))
    expect(orderWebRemoteEndpoints(stalePreferred)).toEqual([LAN, LOOPBACK, TAILNET, FUNNEL])

    const kindOrder = {
      endpoints: [LOOPBACK, TAILNET, LAN, FUNNEL],
      preferredEndpoint: FUNNEL,
      url: LAN,
    }
    expect(orderWebRemoteEndpoints(kindOrder)).toEqual([FUNNEL, LAN, LOOPBACK, TAILNET])
  })
})

describe('classifyRemoteFailure', () => {
  it('uses publicErrorFixtures and session:mismatch without reading Error.message', () => {
    expect(classifyRemoteFailure(publicErrorFixtures['auth.forbidden'])).toEqual({
      kind: 'public',
      error: publicErrorFixtures['auth.forbidden'],
    })
    expect(classifyRemoteFailure(publicErrorFixtures['protocol.update-required'])).toEqual({
      kind: 'update-required',
      error: publicErrorFixtures['protocol.update-required'],
    })

    const mismatch = classifyRemoteFailure(sessionContractFixtures.mismatch)
    expect(mismatch.kind).toBe('update-required')

    const bait = {
      ...publicErrorFixtures['auth.unauthenticated'],
      message: publicErrorFixtures['protocol.update-required'].message,
    }
    expect(classifyRemoteFailure(bait)).toEqual({ kind: 'public', error: bait })
    expect(classifyRemoteFailure(new TypeError(bait.message))).toEqual({ kind: 'unreachable' })
  })

  it('reports retryability from the parsed kind, not a message string', () => {
    expect(isRemoteRetryable(classifyRemoteFailure(publicErrorFixtures['auth.forbidden']))).toBe(
      false,
    )
    expect(
      isRemoteRetryable(classifyRemoteFailure(publicErrorFixtures['protocol.update-required'])),
    ).toBe(false)
    expect(isRemoteRetryable(classifyRemoteFailure(new TypeError('offline')))).toBe(true)
  })
})

describe('mapAdapterStatus', () => {
  it('maps the current Web adapter vocabulary onto REM-003 health', () => {
    expect(mapAdapterStatus('idle')).toBe('idle')
    expect(mapAdapterStatus('connecting')).toBe('connecting')
    expect(mapAdapterStatus('open')).toBe('healthy')
    expect(mapAdapterStatus('reconnecting')).toBe('recovering')
    expect(mapAdapterStatus('update-required')).toBe('update-required')
  })
})
