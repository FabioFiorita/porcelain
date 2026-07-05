import { describe, expect, it } from 'vitest'
import { normalizeDaemonUrl } from './remote-daemon'

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
