import { describe, expect, it } from 'vitest'
import { createPairingBundleLink, parsePairingBundleLink } from './pairing-bundle'

describe('pairing bundle links', () => {
  it('round-trips independently issued Environment links and their names', () => {
    const environments = [
      { name: 'Windows', url: 'http://192.168.1.4:43117/pair#token=pc_pair_windows_secret' },
      { name: 'WSL', url: 'http://172.24.1.2:43119/pair#token=pc_pair_wsl_secret' },
    ]

    const link = createPairingBundleLink(environments)

    expect(
      link.startsWith('http://192.168.1.4:43117/pair#token=pc_pair_windows_secret&bundle='),
    ).toBe(true)
    expect(parsePairingBundleLink(link)).toEqual({
      environments,
      version: 1,
    })
  })

  it('does not mistake an ordinary pairing link or malformed bundle for a bundle', () => {
    expect(parsePairingBundleLink('https://host/pair#token=pc_pair_one_secret')).toBeNull()
    expect(parsePairingBundleLink('https://host/pair#bundle=%7Bbad')).toBeNull()
  })

  it('continues to parse previously issued custom-scheme bundles', () => {
    const legacy =
      'porcelain://pair-environments#bundle=' +
      encodeURIComponent(
        JSON.stringify({
          environments: [{ name: 'Windows', url: 'http://host/pair#token=secret' }],
          version: 1,
        }),
      )

    expect(parsePairingBundleLink(legacy)?.environments[0]?.name).toBe('Windows')
  })
})
