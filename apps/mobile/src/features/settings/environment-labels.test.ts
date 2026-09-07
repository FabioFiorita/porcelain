import { publicErrorFixtures } from '@porcelain/contracts'
import { describe, expect, it, vi } from 'vitest'

// Labels need only the Remote feature's pure environment identity. The real index also carries
// the Secure Store adapter, which reaches into a native module that has no meaning under Vitest.
vi.mock('@/features/remote', async () => ({
  ...(await vi.importActual<typeof import('@/features/remote/remote-environment')>(
    '@/features/remote/remote-environment',
  )),
}))

import {
  connectionStatusLabel,
  endpointLabel,
  movedOrder,
  promotedOrder,
} from './environment-labels'

describe('endpointLabel', () => {
  it('names the three route shapes a human picks between', () => {
    expect(endpointLabel('http://192.168.1.10:43118')).toBe('LAN')
    expect(endpointLabel('http://beelink.tail1234.ts.net:43118')).toBe('Tailscale')
    expect(endpointLabel('https://porcelain.example.com')).toBe('Cloudflare / Internet')
  })

  it('names loopback LAN, not Cloudflare/Internet — this machine is not remote from itself', () => {
    expect(endpointLabel('http://127.0.0.1:43200')).toBe('LAN')
  })
})

describe('connectionStatusLabel', () => {
  // Two states share one label on purpose: "loading" and "connecting" are the same wait.
  it('collapses the wait states and names the failures apart', () => {
    expect(connectionStatusLabel('loading')).toBe('Connecting…')
    expect(connectionStatusLabel('connecting')).toBe('Connecting…')
    expect(connectionStatusLabel('ready')).toBe('Connected')
    expect(connectionStatusLabel('unreachable')).toBe('Unreachable')
    expect(connectionStatusLabel('unauthorized')).toBe('Token rejected')
    expect(connectionStatusLabel('no-environment')).toBe('None')
  })

  // The sentence is the contract's, not ours: `publicErrorFixtures['protocol.update-required']`.
  it('uses the contract sentence when the daemon refuses this build protocol', () => {
    expect(connectionStatusLabel('update-required')).toBe(
      publicErrorFixtures['protocol.update-required'].message,
    )
  })
})

describe('promotedOrder', () => {
  // The list has to agree with the failover it describes: primary first, then the rest.
  it('hoists the promoted route to the front, keeping the rest in order', () => {
    expect(promotedOrder(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b'])
  })

  it('is a no-op for a route already first', () => {
    expect(promotedOrder(['a', 'b'], 'a')).toEqual(['a', 'b'])
  })
})

describe('movedOrder', () => {
  it('swaps a row with its neighbour', () => {
    expect(movedOrder(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(movedOrder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })

  // Nothing to write beats writing the same order back.
  it('refuses a move off either end', () => {
    expect(movedOrder(['a', 'b'], 0, -1)).toBeNull()
    expect(movedOrder(['a', 'b'], 1, 1)).toBeNull()
  })

  it('does not mutate the list it was given', () => {
    const endpoints = ['a', 'b']
    movedOrder(endpoints, 0, 1)
    expect(endpoints).toEqual(['a', 'b'])
  })
})
