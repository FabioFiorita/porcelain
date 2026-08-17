import { isCloudflareEndpoint } from '@porcelain/contracts'
import { describe, expect, it } from 'vitest'
import { orderRemoteEndpoints } from './endpoints'

const LAN = 'http://192.168.1.50:43117'
const TAILNET = 'http://100.64.0.1:43117'
const CLOUDFLARE = 'https://random-words-here.trycloudflare.com'
const LOOPBACK = 'http://127.0.0.1:43117'

describe('isCloudflareEndpoint', () => {
  it('recognizes quick-tunnel hostnames only', () => {
    expect(isCloudflareEndpoint(CLOUDFLARE)).toBe(true)
    expect(isCloudflareEndpoint('https://id.cfargotunnel.com')).toBe(true)
    expect(isCloudflareEndpoint(LAN)).toBe(false)
    expect(isCloudflareEndpoint('https://example.ts.net')).toBe(false)
  })
})

describe('orderRemoteEndpoints', () => {
  it('walks LAN, then Tailscale, then Cloudflare regardless of stored preference', () => {
    expect(
      orderRemoteEndpoints({
        endpoints: [CLOUDFLARE, TAILNET, LAN],
        preferredEndpoint: CLOUDFLARE,
        url: TAILNET,
      }),
    ).toEqual([LAN, TAILNET, CLOUDFLARE])
  })

  it('ignores a preferred address the group no longer knows', () => {
    expect(
      orderRemoteEndpoints({
        endpoints: [LAN, TAILNET],
        preferredEndpoint: 'http://192.168.9.9:43117',
        url: TAILNET,
      }),
    ).toEqual([LAN, TAILNET])
  })

  it('drops a last-known-good url that is not in the stored group', () => {
    expect(
      orderRemoteEndpoints({
        endpoints: [TAILNET],
        url: 'http://192.168.9.9:43117',
      }),
    ).toEqual([TAILNET])
  })

  it('falls back to the last-known-good url when endpoints is empty', () => {
    expect(orderRemoteEndpoints({ url: LAN })).toEqual([LAN])
    expect(orderRemoteEndpoints({ endpoints: [], url: LAN })).toEqual([LAN])
  })

  it('collapses duplicate addresses', () => {
    expect(
      orderRemoteEndpoints({
        endpoints: [LAN, TAILNET, LAN, CLOUDFLARE, TAILNET],
        preferredEndpoint: LAN,
        url: LAN,
      }),
    ).toEqual([LAN, TAILNET, CLOUDFLARE])
  })

  it('ranks loopback with other public routes, after LAN and Tailscale', () => {
    expect(
      orderRemoteEndpoints({
        endpoints: [LOOPBACK, TAILNET, LAN, CLOUDFLARE],
        preferredEndpoint: CLOUDFLARE,
        url: LAN,
      }),
    ).toEqual([LAN, TAILNET, LOOPBACK, CLOUDFLARE])
  })
})
