// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  isCloudflareMissing,
  namedTunnelReady,
  normalizeCloudflareHostname,
  parseCloudflareTunnelUrl,
  planCloudflareLaunch,
  readCloudflareCredentials,
} from './remote-cloudflare'

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

  it('treats a named-tunnel registration line as ready', () => {
    expect(namedTunnelReady('INF Registered tunnel connection connIndex=0')).toBe(true)
    expect(namedTunnelReady('INF Starting metrics server')).toBe(false)
  })

  it('recognizes a missing cloudflared binary', () => {
    expect(isCloudflareMissing(Object.assign(new Error('spawn'), { code: 'ENOENT' }))).toBe(true)
    expect(isCloudflareMissing(new Error('cloudflared did not become ready'))).toBe(false)
    expect(isCloudflareMissing(null)).toBe(false)
  })
})

describe('named Cloudflare credentials', () => {
  it('normalizes a bare host to an https origin', () => {
    expect(normalizeCloudflareHostname('review.example.com')).toBe('https://review.example.com')
    expect(normalizeCloudflareHostname('https://review.example.com/')).toBe(
      'https://review.example.com',
    )
  })

  it('rejects a path, credentials, or http hostname', () => {
    expect(() => normalizeCloudflareHostname('https://review.example.com/app')).toThrow(/path/)
    expect(() => normalizeCloudflareHostname('http://review.example.com')).toThrow(/https/)
  })

  it('plans a named run when a token is present, and a quick tunnel otherwise', () => {
    expect(
      planCloudflareLaunch({
        hostname: 'https://review.example.com',
        target: 'http://127.0.0.1:43117',
        token: 'tunnel-token',
      }),
    ).toEqual({
      args: ['tunnel', '--no-autoupdate', 'run'],
      hostname: 'https://review.example.com',
      mode: 'named',
    })
    expect(
      planCloudflareLaunch({
        hostname: null,
        target: 'http://127.0.0.1:43117',
        token: null,
      }),
    ).toEqual({
      args: ['tunnel', '--url', 'http://127.0.0.1:43117', '--no-autoupdate'],
      mode: 'quick',
    })
  })

  it('refuses a token without a public hostname', () => {
    expect(() =>
      planCloudflareLaunch({
        hostname: null,
        target: 'http://127.0.0.1:43117',
        token: 'tunnel-token',
      }),
    ).toThrow(/PORCELAIN_CLOUDFLARE_HOSTNAME/)
  })

  it('reads token and hostname from env without inventing values', () => {
    expect(
      readCloudflareCredentials({
        PORCELAIN_CLOUDFLARE_HOSTNAME: 'review.example.com',
        PORCELAIN_CLOUDFLARE_TOKEN: '  secret  ',
      }),
    ).toEqual({ hostname: 'https://review.example.com', token: 'secret' })
    expect(readCloudflareCredentials({})).toEqual({ hostname: null, token: null })
  })
})
