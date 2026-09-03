import { describe, expect, it } from 'vitest'
import { createPairingBundleLink, parsePairingBundleLink } from './pairing-bundle'

describe('pairing bundle links', () => {
  it('round-trips independently issued Environment links and their names', () => {
    const environments = [
      { name: 'Windows', url: 'http://192.168.1.4:43117/pair#token=pc_pair_windows_secret' },
      { name: 'WSL', url: 'http://172.24.1.2:43119/pair#token=pc_pair_wsl_secret' },
    ]

    expect(parsePairingBundleLink(createPairingBundleLink(environments))).toEqual({
      environments,
      version: 1,
    })
  })

  it('does not mistake an ordinary pairing link or malformed bundle for a bundle', () => {
    expect(parsePairingBundleLink('https://host/pair#token=pc_pair_one_secret')).toBeNull()
    expect(parsePairingBundleLink('porcelain://pair-environments#bundle=%7Bbad')).toBeNull()
  })
})
