import { z } from 'zod'

export const pairingBundleEntrySchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().min(1),
})

export const pairingBundleSchema = z.object({
  environments: z.array(pairingBundleEntrySchema).min(1),
  version: z.literal(1),
})

export type PairingBundleEntry = z.infer<typeof pairingBundleEntrySchema>
export type PairingBundle = z.infer<typeof pairingBundleSchema>

const LEGACY_PREFIX = 'porcelain://pair-environments#bundle='
const HTTP_BUNDLE_LINK = /^(https?:\/\/[^/?#\s@]+)\/pair#([^#\s]*)$/i

export function isPairingBundleLink(input: string): boolean {
  const trimmed = input.trim()
  return (
    trimmed.startsWith('porcelain://pair-environments') ||
    (HTTP_BUNDLE_LINK.test(trimmed) && readFragmentBundle(trimmed) !== null)
  )
}

/**
 * One browser-safe credential envelope. The first daemon's origin makes the bundle an ordinary
 * HTTP(S) link that survives cross-device clipboard and QR handoff; the fragment still keeps every
 * independently-issued, single-use grant out of server request lines.
 */
export function createPairingBundleLink(entries: readonly PairingBundleEntry[]): string {
  const bundle = pairingBundleSchema.parse({ environments: entries, version: 1 })
  const first = new URL(bundle.environments[0]?.url ?? '')
  if (
    (first.protocol !== 'http:' && first.protocol !== 'https:') ||
    first.username !== '' ||
    first.password !== '' ||
    first.pathname !== '/pair' ||
    first.search !== ''
  ) {
    throw new Error('Pairing bundle entries must use valid HTTP(S) pairing links')
  }
  const credential = new URLSearchParams(first.hash.slice(1)).get('token')
  if (credential === null || credential === '') {
    throw new Error('The first pairing bundle entry has no credential')
  }
  return `${first.origin}/pair#token=${encodeURIComponent(credential)}&bundle=${encodeURIComponent(JSON.stringify(bundle))}`
}

export function parsePairingBundleLink(input: string): PairingBundle | null {
  const trimmed = input.trim()
  const encoded = trimmed.startsWith(LEGACY_PREFIX)
    ? trimmed.slice(LEGACY_PREFIX.length)
    : readFragmentBundle(trimmed)
  if (encoded === null) return null
  try {
    return pairingBundleSchema.parse(JSON.parse(decodeURIComponent(encoded)))
  } catch {
    return null
  }
}

function readFragmentBundle(input: string): string | null {
  const match = HTTP_BUNDLE_LINK.exec(input)
  const fragment = match?.[2]
  if (fragment === undefined) return null
  for (const pair of fragment.split('&')) {
    const separator = pair.indexOf('=')
    if (separator !== -1 && pair.slice(0, separator) === 'bundle') {
      const value = pair.slice(separator + 1)
      return value === '' ? null : value
    }
  }
  return null
}
