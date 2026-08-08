import { describe, expect, it } from 'vitest'

import type { Environment } from '@/lib/daemon/environment'
import type { ConnectionState } from '@/lib/daemon/environments-store'

import {
  connectionStatusLabel,
  describeConnection,
  endpointLabel,
  movedOrder,
  promotedOrder,
} from './environment-labels'

const environment = (overrides: Partial<Environment> = {}): Environment => ({
  activeRepoPath: null,
  baseUrl: 'http://192.168.1.10:43118',
  createdAt: 0,
  endpoints: ['http://192.168.1.10:43118'],
  icon: 'desktop',
  id: 'env-1',
  nickname: 'Beelink',
  preferredEndpoint: 'http://192.168.1.10:43118',
  token: 'tok',
  ...overrides,
})

const ready: ConnectionState = {
  daemonVersion: '0.52.0',
  kind: 'ready',
  reachability: {
    attempted: [],
    consecutiveFailures: 0,
    source: 'endpoint-walk',
    state: 'reachable',
  },
}

describe('endpointLabel', () => {
  it('names the three route shapes a human picks between', () => {
    expect(endpointLabel('http://192.168.1.10:43118')).toBe('LAN')
    expect(endpointLabel('http://beelink.tail1234.ts.net:43118')).toBe('Tailscale')
    expect(endpointLabel('https://porcelain.example.com')).toBe('Funnel / Internet')
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
})

describe('describeConnection', () => {
  it('reports the live daemon version for the active group', () => {
    expect(describeConnection(environment(), true, ready)).toBe('daemon 0.52.0 · 1 connection')
  })

  it('pluralizes the route count', () => {
    const two = environment({
      endpoints: ['http://a:43118', 'http://b:43118'],
    })
    expect(describeConnection(two, true, ready)).toBe('daemon 0.52.0 · 2 connections')
  })

  // An idle group has no connection to report, so it is described by what is saved about it.
  it('names the preferred host for a group that is not active', () => {
    expect(describeConnection(environment(), false, ready)).toBe('192.168.1.10 · 1 connection')
  })

  it('says unpaired when the token was revoked on the host', () => {
    expect(describeConnection(environment({ token: null }), false, ready)).toBe(
      'Unpaired · 1 connection',
    )
  })

  it('reports what the active group failed with', () => {
    expect(describeConnection(environment(), true, { kind: 'unauthorized' })).toBe(
      'Token rejected · 1 connection',
    )
    expect(describeConnection(environment(), true, { kind: 'connecting' })).toBe(
      'Connecting… · 1 connection',
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
