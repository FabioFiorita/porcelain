import type { networkInterfaces } from 'node:os'
import { describe, expect, it } from 'vitest'
import { findTailscaleAddress } from './tailnet'

type Interfaces = ReturnType<typeof networkInterfaces>

// Minimal fabricated NetworkInterfaceInfo — only the fields findTailscaleAddress reads.
const v4 = (address: string, internal = false): NonNullable<Interfaces[string]>[number] => ({
  address,
  netmask: '255.192.0.0',
  family: 'IPv4',
  mac: '00:00:00:00:00:00',
  internal,
  cidr: `${address}/10`,
})

const v6 = (address: string): NonNullable<Interfaces[string]>[number] => ({
  address,
  netmask: 'ffff:ffff:ffff:ffff::',
  family: 'IPv6',
  mac: '00:00:00:00:00:00',
  internal: false,
  cidr: `${address}/64`,
  scopeid: 0,
})

describe('findTailscaleAddress', () => {
  it('finds a 100.64/10 address', () => {
    const interfaces: Interfaces = {
      en0: [v4('192.168.1.20')],
      utun3: [v4('100.101.102.103')],
    }
    expect(findTailscaleAddress(interfaces)).toBe('100.101.102.103')
  })

  it('accepts the low and high ends of the range (100.64 and 100.127)', () => {
    expect(findTailscaleAddress({ utun0: [v4('100.64.0.1')] })).toBe('100.64.0.1')
    expect(findTailscaleAddress({ utun0: [v4('100.127.255.254')] })).toBe('100.127.255.254')
  })

  it('ignores LAN, loopback, and non-CGNAT 100.x addresses', () => {
    const interfaces: Interfaces = {
      en0: [v4('192.168.1.20')],
      en1: [v4('10.0.0.5')],
      lo0: [v4('127.0.0.1', true), v6('::1')],
      // 100.128.x is outside 100.64/10; a public 100.x that isn't Tailscale.
      other: [v4('100.128.0.1')],
    }
    expect(findTailscaleAddress(interfaces)).toBeNull()
  })

  it('ignores an internal 100.x address', () => {
    expect(findTailscaleAddress({ utun0: [v4('100.100.100.100', true)] })).toBeNull()
  })

  it('returns null when no interfaces qualify', () => {
    expect(findTailscaleAddress({})).toBeNull()
  })
})
