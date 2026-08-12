import { describe, expect, it } from 'vitest'
import { orderRemoteEndpoints } from './endpoints'

const LAN = 'http://192.168.1.50:43117'
const TAILNET = 'http://100.64.0.1:43117'
const FUNNEL = 'https://beelink.example.ts.net'
const LOOPBACK = 'http://127.0.0.1:43117'

describe('orderRemoteEndpoints', () => {
  it('tries the exact preferred route, then last-known-good, then the rest', () => {
    expect(
      orderRemoteEndpoints({
        endpoints: [LAN, FUNNEL],
        preferredEndpoint: LAN,
        url: FUNNEL,
      }),
    ).toEqual([LAN, FUNNEL])
    expect(
      orderRemoteEndpoints({
        endpoints: [LAN, TAILNET],
        preferredEndpoint: LAN,
        url: TAILNET,
      }),
    ).toEqual([LAN, TAILNET])
    expect(
      orderRemoteEndpoints({
        endpoints: [LAN, TAILNET, FUNNEL],
        preferredEndpoint: FUNNEL,
        url: LAN,
      }),
    ).toEqual([FUNNEL, LAN, TAILNET])
  })

  it('ignores a preferred address the group no longer knows', () => {
    expect(
      orderRemoteEndpoints({
        endpoints: [LAN, TAILNET],
        preferredEndpoint: 'http://192.168.9.9:43117',
        url: TAILNET,
      }),
    ).toEqual([TAILNET, LAN])
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
        endpoints: [LAN, TAILNET, LAN, FUNNEL, TAILNET],
        preferredEndpoint: LAN,
        url: LAN,
      }),
    ).toEqual([LAN, TAILNET, FUNNEL])
  })

  it('does not rank LAN, tailnet, Funnel, or loopback by kind', () => {
    expect(
      orderRemoteEndpoints({
        endpoints: [LOOPBACK, TAILNET, LAN, FUNNEL],
        preferredEndpoint: FUNNEL,
        url: LAN,
      }),
    ).toEqual([FUNNEL, LAN, LOOPBACK, TAILNET])
  })
})
