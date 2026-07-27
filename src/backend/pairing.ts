import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Short-lived pairing codes, so adding an environment stops meaning "go find
 * `~/.porcelain/daemon-token` on the other machine and paste 64 hex characters".
 *
 * SECURITY — this backs the daemon's ONE unauthenticated endpoint (`POST /pair`, see
 * daemon-http.ts), which is a deliberate exception to "auth is never optional" and is
 * only defensible because of the guards below. If you change any of them, change the
 * audit skill's entry too:
 *
 * - **It exists only while the human is actively pairing.** No pending code → the route
 *   404s, so there is nothing to attack at rest. That's the main mitigation: the window
 *   is minutes long and human-initiated, not always-on.
 * - **40 bits of entropy** (8 Crockford-base32 chars), not a 6-digit PIN. A tailnet/LAN
 *   peer gets nowhere brute-forcing this inside the TTL.
 * - **Single-use, TTL-bounded, attempt-bounded.** Redeeming clears it; so does expiry;
 *   so do 5 wrong guesses. A burned code cannot be retried, it has to be re-minted from
 *   the UI on the machine itself.
 * - **Constant-time comparison over sha256 digests**, the same shape as the token gate.
 * - **Never logged.** Neither the code nor the token it yields.
 *
 * State is in-memory ON PURPOSE: a pairing must not survive a daemon restart, and there
 * is nothing to persist that would be safe to leave on disk.
 */

/** Ten minutes: long enough to walk to the other device, short enough to be a window. */
export const PAIRING_TTL_MS = 10 * 60_000

/** Wrong guesses before the code is burned and must be re-minted by a human. */
export const MAX_PAIRING_ATTEMPTS = 5

// Crockford base32: no I, L, O, or U — the characters people mistype when reading a
// code off one screen and typing it into another.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 8

export interface PendingPairing {
  /** The plaintext code, so the machine's OWN settings UI can display it. */
  code: string
  expiresAt: number
}

interface PairingState {
  code: string
  hash: Buffer
  expiresAt: number
  attemptsLeft: number
}

let state: PairingState | null = null

/** The result of an exchange attempt; only `ok` yields a credential. */
export type RedeemResult = 'ok' | 'invalid' | 'expired' | 'none'

/**
 * A fresh pairing code, formatted `XXXX-XXXX` for reading aloud. Pure apart from the
 * randomness, which is injectable so a test can pin the output.
 *
 * Rejection-free mapping: 32 is a divisor of 256, so `byte % 32` is uniform over the
 * alphabet — no modulo bias to reason about.
 */
export function generatePairingCode(random: (size: number) => Buffer = randomBytes): string {
  const bytes = random(CODE_LENGTH)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`
}

/**
 * Canonicalize a typed or pasted code: drop separators/whitespace, uppercase, and fold
 * the look-alike characters Crockford excludes (O→0, I/L→1) so a human who reads "0"
 * as "O" still pairs. Pure — unit-tested.
 */
export function normalizePairingCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
}

const digest = (code: string): Buffer => createHash('sha256').update(code).digest()

/**
 * Mint a code, replacing any code already pending (the human pressed the button again
 * — the older code must stop working, not accumulate).
 */
export function startPairing(
  now = Date.now(),
  random: (size: number) => Buffer = randomBytes,
): PendingPairing {
  const code = generatePairingCode(random)
  state = {
    code,
    hash: digest(normalizePairingCode(code)),
    expiresAt: now + PAIRING_TTL_MS,
    attemptsLeft: MAX_PAIRING_ATTEMPTS,
  }
  return { code, expiresAt: state.expiresAt }
}

/** The pending code, or null when none is pending or it has aged out. */
export function pendingPairing(now = Date.now()): PendingPairing | null {
  if (state === null) return null
  if (now >= state.expiresAt) {
    state = null
    return null
  }
  return { code: state.code, expiresAt: state.expiresAt }
}

/** Drop any pending code (the human cancelled, or the daemon is shutting down). */
export function cancelPairing(): void {
  state = null
}

/**
 * Exchange a code. Consumes the pending pairing on success; burns it after
 * `MAX_PAIRING_ATTEMPTS` failures. Distinguishing `expired` from `none` is for the
 * caller's message only — both refuse.
 */
export function redeemPairing(input: string, now = Date.now()): RedeemResult {
  if (state === null) return 'none'
  if (now >= state.expiresAt) {
    state = null
    return 'expired'
  }
  const candidate = digest(normalizePairingCode(input))
  // Equal-length sha256 digests, so timingSafeEqual is safe to call directly.
  if (timingSafeEqual(state.hash, candidate)) {
    state = null
    return 'ok'
  }
  state.attemptsLeft -= 1
  if (state.attemptsLeft <= 0) state = null
  return 'invalid'
}
