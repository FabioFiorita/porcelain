// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isCloudflareMissing, parseCloudflareTunnelUrl } from './remote-cloudflare'

describe('Cloudflare tunnel output parsing', () => {
  it('extracts the quick-tunnel URL from mixed cloudflared logs', () => {
    expect(
      parseCloudflareTunnelUrl(
        [
          'INF Starting metrics server',
          '|  https://random-words-here.trycloudflare.com  |',
          'INF Connection registered',
        ].join('\n'),
      ),
    ).toBe('https://random-words-here.trycloudflare.com')
  })

  it('ignores unrelated https hosts and empty output', () => {
    expect(parseCloudflareTunnelUrl('https://example.ts.net')).toBeNull()
    expect(parseCloudflareTunnelUrl('')).toBeNull()
  })

  it('recognizes a missing cloudflared binary', () => {
    expect(isCloudflareMissing(Object.assign(new Error('spawn'), { code: 'ENOENT' }))).toBe(true)
    expect(isCloudflareMissing(new Error('cloudflared did not publish a tunnel URL'))).toBe(false)
    expect(isCloudflareMissing(null)).toBe(false)
  })
})
