import type { networkInterfaces } from 'node:os'
import { describe, expect, it, vi } from 'vitest'

// lanDisplayHost reads os.hostname(); make it deterministic. findLanAddresses
// takes injected interfaces, so the real networkInterfaces is never hit.
const host = vi.hoisted(() => ({ name: 'my-mac' }))
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  // The `default` mirror keeps vitest's CJS interop happy (node:os resolves via
  // its default). networkInterfaces stays real — findLanAddresses is fed injected
  // interfaces, so only hostname needs overriding.
  const mocked = { ...actual, hostname: () => host.name }
  return { ...mocked, default: mocked }
})

import { findLanAddresses, lanDisplayHost } from './lan'

type Interfaces = ReturnType<typeof networkInterfaces>

// Minimal fabricated NetworkInterfaceInfo — only the fields findLanAddresses reads.
const v4 = (address: string, internal = false): NonNullable<Interfaces[string]>[number] => ({
  address,
  netmask: '255.255.255.0',
  family: 'IPv4',
  mac: '00:00:00:00:00:00',
  internal,
  cidr: `${address}/24`,
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

describe('findLanAddresses', () => {
  it('finds RFC1918 addresses across all three ranges', () => {
    expect(findLanAddresses({ en0: [v4('10.1.2.3')] })).toEqual(['10.1.2.3'])
    expect(findLanAddresses({ en0: [v4('172.16.5.5')] })).toEqual(['172.16.5.5'])
    expect(findLanAddresses({ en0: [v4('172.31.255.254')] })).toEqual(['172.31.255.254'])
    expect(findLanAddresses({ en0: [v4('192.168.1.20')] })).toEqual(['192.168.1.20'])
  })

  it('excludes the 172.16/12 boundary misses (172.15 and 172.32)', () => {
    expect(findLanAddresses({ en0: [v4('172.15.0.1')] })).toEqual([])
    expect(findLanAddresses({ en0: [v4('172.32.0.1')] })).toEqual([])
  })

  it('excludes the Tailscale CGNAT range (100.64/10) — that belongs to tailnet.ts', () => {
    expect(findLanAddresses({ utun0: [v4('100.101.102.103')] })).toEqual([])
  })

  it('excludes 192.x that is not 192.168 (e.g. 192.169)', () => {
    expect(findLanAddresses({ en0: [v4('192.169.0.1')] })).toEqual([])
  })

  it('skips internal and IPv6 addresses', () => {
    const interfaces: Interfaces = {
      lo0: [v4('127.0.0.1', true), v6('::1')],
      en0: [v4('192.168.1.20', true), v6('fe80::1')],
    }
    expect(findLanAddresses(interfaces)).toEqual([])
  })

  it('returns all matches when Wi-Fi and Ethernet are both up, in enumeration order', () => {
    const interfaces: Interfaces = {
      en0: [v4('192.168.1.20')],
      en1: [v4('10.0.0.5')],
      utun3: [v4('100.90.90.90')],
    }
    expect(findLanAddresses(interfaces)).toEqual(['192.168.1.20', '10.0.0.5'])
  })

  it('returns [] when no interface qualifies', () => {
    expect(findLanAddresses({})).toEqual([])
  })
})

describe('lanDisplayHost', () => {
  it('returns null for no addresses', () => {
    expect(lanDisplayHost([])).toBeNull()
  })

  it('appends .local when the hostname lacks it', () => {
    host.name = 'my-mac'
    expect(lanDisplayHost(['192.168.1.20'])).toBe('my-mac.local')
  })

  it('keeps an existing .local suffix without doubling it', () => {
    host.name = 'my-mac.local'
    expect(lanDisplayHost(['192.168.1.20'])).toBe('my-mac.local')
  })

  it('falls back to the first numeric address when the hostname is unusable', () => {
    host.name = 'localhost'
    expect(lanDisplayHost(['192.168.1.20', '10.0.0.5'])).toBe('192.168.1.20')
    host.name = ''
    expect(lanDisplayHost(['10.0.0.5'])).toBe('10.0.0.5')
    host.name = 'my-mac'
  })
})
