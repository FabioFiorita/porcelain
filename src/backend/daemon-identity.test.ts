import { describe, expect, it } from 'vitest'
import { daemonIdentity, shortHostname } from './daemon-identity'

describe('shortHostname', () => {
  it('passes a bare host through', () => {
    expect(shortHostname('beelink')).toBe('beelink')
  })

  it('drops a .local suffix', () => {
    expect(shortHostname('beelink.local')).toBe('beelink')
  })

  it('drops a multi-label DNS domain', () => {
    expect(shortHostname('beelink.tailnet.ts.net')).toBe('beelink')
  })

  it('keeps an IPv4 host whole', () => {
    // Splitting on the first dot would render this as "192".
    expect(shortHostname('192.168.1.9')).toBe('192.168.1.9')
  })

  it('trims surrounding whitespace', () => {
    expect(shortHostname('  beelink.local  ')).toBe('beelink')
  })

  it('returns empty for a blank host so callers can fall back', () => {
    expect(shortHostname('   ')).toBe('')
  })
})

describe('daemonIdentity', () => {
  it('shortens the host and passes platform/arch through', () => {
    expect(daemonIdentity('beelink.local', 'linux', 'x64')).toEqual({
      host: 'beelink',
      platform: 'linux',
      arch: 'x64',
    })
  })
})
