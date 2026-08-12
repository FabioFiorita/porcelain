// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { funnelConfigurationContains, funnelPublicUrl } from './remote-funnel'

describe('Tailscale Funnel output parsing', () => {
  it('finds the daemon target without depending on Tailscale JSON key names', () => {
    const target = 'http://127.0.0.1:43117'
    expect(
      funnelConfigurationContains(
        { Web: { 'beelink.example.ts.net:443': { Handlers: { '/': { Proxy: target } } } } },
        target,
      ),
    ).toBe(true)
    expect(funnelConfigurationContains({}, target)).toBe(false)
    expect(funnelConfigurationContains({ Proxy: `${target}0` }, target)).toBe(false)
  })

  it('derives the public HTTPS URL from the tailnet DNS name', () => {
    expect(funnelPublicUrl({ Self: { DNSName: 'beelink.example.ts.net.' } })).toBe(
      'https://beelink.example.ts.net',
    )
    expect(funnelPublicUrl({ Self: {} })).toBeNull()
    expect(funnelPublicUrl(null)).toBeNull()
  })
})
