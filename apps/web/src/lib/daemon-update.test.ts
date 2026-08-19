import { describe, expect, it } from 'vitest'
import { compareVersions, isLoopbackHostname, shouldPromptDaemonUpdate } from './daemon-update'

describe('compareVersions', () => {
  it('orders by numeric segment, not lexicographically', () => {
    expect(compareVersions('0.9.0', '0.10.0')).toBe(-1)
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1)
    expect(compareVersions('1.0.0', '0.99.99')).toBe(1)
  })

  it('treats equal versions as equal, with or without a v prefix', () => {
    expect(compareVersions('0.55.0', '0.55.0')).toBe(0)
    expect(compareVersions('v0.55.0', '0.55.0')).toBe(0)
  })

  it('pads missing segments with zero', () => {
    expect(compareVersions('0.55', '0.55.0')).toBe(0)
    expect(compareVersions('0.55', '0.55.1')).toBe(-1)
  })

  it('reads a prerelease as its numeric prefix so it never outranks the release', () => {
    expect(compareVersions('0.55.0-rc.1', '0.55.0')).toBe(0)
    expect(compareVersions('0.54.0-rc.1', '0.55.0')).toBe(-1)
  })
})

describe('isLoopbackHostname', () => {
  it('recognizes the machine in front of you', () => {
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('beelink.local')).toBe(true)
  })

  it('treats every routed address as another machine', () => {
    expect(isLoopbackHostname('beelink.tail1234.ts.net')).toBe(false)
    expect(isLoopbackHostname('192.168.1.20')).toBe(false)
    expect(isLoopbackHostname('review.example.com')).toBe(false)
  })
})

const base = {
  clientVersion: '0.55.0',
  daemonVersion: '0.53.0',
  daemonHost: 'beelink',
  isRemote: true,
  dismissed: {},
} as const

describe('shouldPromptDaemonUpdate', () => {
  it('prompts for a remote daemon behind this client', () => {
    expect(shouldPromptDaemonUpdate(base)).toBe(true)
  })

  it('stays quiet for the daemon on this machine', () => {
    expect(shouldPromptDaemonUpdate({ ...base, isRemote: false })).toBe(false)
  })

  it('stays quiet when the daemon matches or leads', () => {
    expect(shouldPromptDaemonUpdate({ ...base, daemonVersion: '0.55.0' })).toBe(false)
    expect(shouldPromptDaemonUpdate({ ...base, daemonVersion: '0.56.0' })).toBe(false)
  })

  it('stays quiet until identity lands', () => {
    expect(shouldPromptDaemonUpdate({ ...base, daemonVersion: null })).toBe(false)
    expect(shouldPromptDaemonUpdate({ ...base, daemonHost: null })).toBe(false)
    expect(shouldPromptDaemonUpdate({ ...base, clientVersion: null })).toBe(false)
  })

  it('stays dismissed for the version that was waved off', () => {
    expect(shouldPromptDaemonUpdate({ ...base, dismissed: { beelink: '0.53.0' } })).toBe(false)
  })

  it('asks again once the remote moves to a different, still-old version', () => {
    expect(
      shouldPromptDaemonUpdate({
        ...base,
        daemonVersion: '0.54.0',
        dismissed: { beelink: '0.53.0' },
      }),
    ).toBe(true)
  })

  it('scopes dismissal to the host that was dismissed', () => {
    expect(
      shouldPromptDaemonUpdate({
        ...base,
        daemonHost: 'mac-mini',
        dismissed: { beelink: '0.53.0' },
      }),
    ).toBe(true)
  })
})
