import { createPairingBundleLink } from '@porcelain/contracts/remote'
import { describe, expect, it } from 'vitest'

import { parsePairingQr } from './remote-pairing-qr'

const GRANT = `pc_pair_3f2a1c88-0f4d-4b6e-9a11-2c7d5e8b0a34_${'a'.repeat(64)}`
const OTHER_GRANT = `pc_pair_66d173f0-f5a9-42f1-85a8-08cb5e407108_${'b'.repeat(64)}`

describe('parsePairingQr', () => {
  it('accepts a portable HTTPS pairing link from a custom Cloudflare hostname', () => {
    const connectionLink = `https://remote.example.com/pair#token=${GRANT}`

    expect(parsePairingQr(`  ${connectionLink}\n`)).toEqual({ connectionLink, ok: true })
  })

  it('accepts the browser-safe multi-Environment QR payload', () => {
    const connectionLink = createPairingBundleLink([
      {
        name: 'Windows',
        url: `https://beelink.example.com/pair#token=${GRANT}`,
      },
      {
        name: 'WSL',
        url: `https://wsl.example.com/pair#token=${OTHER_GRANT}`,
      },
    ])

    expect(parsePairingQr(connectionLink)).toEqual({ connectionLink, ok: true })
  })

  it('rejects unrelated and malformed QR payloads', () => {
    expect(parsePairingQr('https://example.com')).toEqual({
      message: 'That QR code is not a Porcelain pairing link.',
      ok: false,
    })
    expect(parsePairingQr('porcelain://pair-environments#bundle=%7Bbad')).toEqual({
      message: 'That Porcelain pairing bundle is malformed.',
      ok: false,
    })
  })
})
