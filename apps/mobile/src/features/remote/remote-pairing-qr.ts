import { isPairingBundleLink, parsePairingBundleLink } from '@porcelain/contracts/remote'

import { parsePairingLink } from './remote-pairing'

export type PairingQrResult = { ok: true; connectionLink: string } | { ok: false; message: string }

/**
 * Accept only the portable links emitted by Share. A QR code is untrusted camera input, so it
 * passes through the same single-link and bundle parsers as pasted credentials before reaching a
 * form. The returned value remains the complete link because the fragment carries the one-shot
 * grant and must be redeemed by the existing pairing path.
 */
export function parsePairingQr(input: string): PairingQrResult {
  const connectionLink = input.trim()
  const bundle = parsePairingBundleLink(connectionLink)
  if (bundle !== null) return { connectionLink, ok: true }
  if (isPairingBundleLink(connectionLink)) {
    return { message: 'That Porcelain pairing bundle is malformed.', ok: false }
  }

  const single = parsePairingLink(connectionLink)
  if (single.ok) return { connectionLink, ok: true }
  return { message: 'That QR code is not a Porcelain pairing link.', ok: false }
}
