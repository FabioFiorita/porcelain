import { describe, expect, it } from 'vitest'
import {
  buildPairingLink,
  pairingCodeFromLocation,
  pairingUrl,
  parsePairingLink,
} from './pairing-link'

describe('buildPairingLink', () => {
  it('puts the code in the hash of the daemon url', () => {
    expect(buildPairingLink('http://beelink:43117', 'ABCD-EFGH')).toBe(
      'http://beelink:43117/#pair=ABCD-EFGH',
    )
  })

  it('does not double the slash when the url already ends in one', () => {
    expect(buildPairingLink('http://beelink:43117/', 'ABCD-EFGH')).toBe(
      'http://beelink:43117/#pair=ABCD-EFGH',
    )
  })
})

describe('pairingUrl', () => {
  it('prefers the numeric address over the .local name a peer may resolve to nothing', () => {
    expect(pairingUrl('http://beelink.local:43117', 'http://192.168.15.64:43117')).toBe(
      'http://192.168.15.64:43117',
    )
  })

  it('keeps the display url when there is no numeric one — the tailnet row', () => {
    expect(pairingUrl('http://100.64.1.2:43117')).toBe('http://100.64.1.2:43117')
    expect(pairingUrl('http://100.64.1.2:43117', null)).toBe('http://100.64.1.2:43117')
  })

  it('does not hand out a blank url when the numeric one is empty', () => {
    expect(pairingUrl('http://beelink.local:43117', '   ')).toBe('http://beelink.local:43117')
  })

  it('builds a link a peer can reach, not one that merely reads well', () => {
    const link = buildPairingLink(
      pairingUrl('http://beelink.local:43117', 'http://192.168.15.64:43117'),
      'ABCD-EFGH',
    )
    expect(link).toBe('http://192.168.15.64:43117/#pair=ABCD-EFGH')
    expect(parsePairingLink(link)?.url).toBe('http://192.168.15.64:43117')
  })
})

describe('parsePairingLink', () => {
  it('round-trips a built link', () => {
    const link = buildPairingLink('http://100.64.1.2:43117', 'ABCD-EFGH')
    expect(parsePairingLink(link)).toEqual({ url: 'http://100.64.1.2:43117', code: 'ABCD-EFGH' })
  })

  it('tolerates the whitespace a paste brings along', () => {
    expect(parsePairingLink('  http://beelink:43117/#pair=ABCD-EFGH\n')).toEqual({
      url: 'http://beelink:43117',
      code: 'ABCD-EFGH',
    })
  })

  it('rejects a url with no pairing code — that is just a daemon address', () => {
    expect(parsePairingLink('http://beelink:43117')).toBeNull()
  })

  it('rejects an empty code', () => {
    expect(parsePairingLink('http://beelink:43117/#pair=')).toBeNull()
  })

  it('rejects a bare code with no url', () => {
    expect(parsePairingLink('ABCD-EFGH')).toBeNull()
  })

  it('rejects a non-http scheme', () => {
    expect(parsePairingLink('ftp://beelink/#pair=ABCD-EFGH')).toBeNull()
  })

  it('drops any path — the origin is what a daemon is reached at', () => {
    expect(parsePairingLink('http://beelink:43117/some/path#pair=ABCD-EFGH')?.url).toBe(
      'http://beelink:43117',
    )
  })
})

describe('pairingCodeFromLocation', () => {
  it('reads the code out of a pairing hash', () => {
    expect(pairingCodeFromLocation('#pair=ABCD-EFGH')).toBe('ABCD-EFGH')
  })

  it('ignores an unrelated hash', () => {
    expect(pairingCodeFromLocation('#section=intent')).toBeNull()
    expect(pairingCodeFromLocation('')).toBeNull()
  })
})
