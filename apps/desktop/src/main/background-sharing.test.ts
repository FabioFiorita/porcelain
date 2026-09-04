import { describe, expect, it } from 'vitest'
import { hasRemoteSharingRoute, type SharingState } from './background-sharing-policy'

const notShared: SharingState = {
  lan: { enabled: false },
  tailnet: { enabled: false },
  cloudflare: { enabled: false, customUrl: null },
}

describe('desktop background sharing policy', () => {
  it('quits normally when no remote route is configured', () => {
    expect(hasRemoteSharingRoute(notShared)).toBe(false)
  })

  it.each([
    ['LAN', { ...notShared, lan: { enabled: true } }],
    ['Tailnet', { ...notShared, tailnet: { enabled: true } }],
    ['managed Cloudflare', { ...notShared, cloudflare: { enabled: true, customUrl: null } }],
    [
      'external Cloudflare',
      {
        ...notShared,
        cloudflare: { enabled: false, customUrl: 'https://porcelain.example.com' },
      },
    ],
  ])('keeps Porcelain running for %s sharing', (_label, state) => {
    expect(hasRemoteSharingRoute(state)).toBe(true)
  })
})
