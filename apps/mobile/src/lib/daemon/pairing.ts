import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { z } from 'zod'

import { DaemonError } from './errors'

/** What a pairing link carries: where the daemon is, and the one-shot grant to redeem there. */
export type PairingLink = {
  baseUrl: string
  credential: string
}

export type PairingLinkProblem = 'empty' | 'malformed' | 'missing-token' | 'foreign-token'

export type ParsedPairingLink =
  | { ok: true; link: PairingLink }
  | { ok: false; problem: PairingLinkProblem }

/** The daemon mints grants with this prefix; a client token (`pc_client_`) is not a pairing link. */
const GRANT_PREFIX = 'pc_pair_'

/**
 * Rejects userinfo in the authority: `http://beelink.local@evil.example` would otherwise store
 * the attacker's origin under a trusted-looking name, and redeeming a grant there hands out a
 * client token. A second `#` is rejected for the same reason — it would silently extend the
 * credential. Both are `malformed`, not best-effort repairs.
 */
const PAIRING_LINK = /^(https?:\/\/[^/?#\s@]+)(?:\/[^?#\s]*)?(?:\?[^#\s]*)?#([^#\s]*)$/i

/**
 * `<origin>/pair#token=pc_pair_<id>_<secret>`, the link the desktop's Share settings copy.
 * The grant rides in the fragment so it never reaches a server in a request line.
 *
 * Parsed by hand, not with `URL`: RN ships a regex shim whose `hash` getter stops at the
 * first `/`, and Vitest would exercise Node's real parser instead of the phone's.
 */
export function parsePairingLink(input: string): ParsedPairingLink {
  const trimmed = input.trim()
  if (trimmed === '') return { ok: false, problem: 'empty' }

  const parts = PAIRING_LINK.exec(trimmed)
  if (parts === null) return { ok: false, problem: 'malformed' }

  const [, origin, fragment] = parts
  if (origin === undefined || fragment === undefined) return { ok: false, problem: 'malformed' }

  const credential = readFragmentToken(fragment)
  if (credential === null) return { ok: false, problem: 'missing-token' }
  if (!credential.startsWith(GRANT_PREFIX)) return { ok: false, problem: 'foreign-token' }

  return { ok: true, link: { baseUrl: origin.toLowerCase(), credential } }
}

function readFragmentToken(fragment: string): string | null {
  for (const pair of fragment.split('&')) {
    const separator = pair.indexOf('=')
    if (separator === -1 || pair.slice(0, separator) !== 'token') continue
    try {
      // Throws `URIError` on a stray `%` — a paste is free text, so this is reachable.
      const value = decodeURIComponent(pair.slice(separator + 1).replace(/\+/g, ' '))
      return value === '' ? null : value
    } catch {
      return null
    }
  }
  return null
}

const pairResponseSchema = z.object({ token: z.string().min(1) })

/**
 * Redeem a grant at `POST <origin>/pair` — the daemon's one unauthenticated mutation, and the
 * only request this app makes without a bearer token. Single-use: a second attempt with the
 * same link is a `daemon-error`, not a retryable failure.
 */
export async function redeemPairingLink(link: PairingLink): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${link.baseUrl}/pair`, {
      body: JSON.stringify({ credential: link.credential }),
      headers: {
        'content-type': 'application/json',
        // Unauthenticated, still versioned: pairing is the first request a phone makes,
        // so a protocol mismatch should surface here rather than after a token exists.
        [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
      },
      method: 'POST',
    })
  } catch (cause) {
    throw new DaemonError('unreachable', 'pair', `Could not reach ${link.baseUrl}.`, { cause })
  }

  if (response.status === 401 || response.status === 403) {
    throw new DaemonError('unauthorized', 'pair', 'That pairing link was already used or expired.')
  }
  if (!response.ok) {
    throw new DaemonError(
      'daemon-error',
      'pair',
      `The daemon refused the link (${response.status}).`,
    )
  }

  const parsed = pairResponseSchema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) {
    throw new DaemonError('invalid-response', 'pair', 'The daemon answered pairing with no token.')
  }
  return parsed.data.token
}
