/**
 * The pairing link — one string that carries both halves of an exchange (where the
 * daemon is, and the code to redeem there).
 *
 * Shape: `<daemon url>/#pair=<CODE>`. That is deliberately the daemon's OWN url with a
 * hash, not a custom `porcelain://` scheme, because it has to serve two consumers with
 * one string:
 *
 * - **A phone/tablet browser** opens it, gets the app shell from that very daemon, and
 *   the client redeems the code on boot — so scanning a QR is the whole setup, with no
 *   token typed on a soft keyboard.
 * - **The Mac app** parses the same pasted string back into `{ url, code }` and does the
 *   exchange itself before saving the environment.
 *
 * The code rides in the **hash**, which is never sent to the server in an HTTP request —
 * so it can't land in an access log on the way. (It's short-lived and single-use anyway;
 * this is belt-and-braces, and matches how T3's hosted pairing handles the same problem.)
 */

const HASH_KEY = 'pair'

/** Build the link a device scans or pastes. `daemonUrl` should be reachable FROM that device. */
export function buildPairingLink(daemonUrl: string, code: string): string {
  return `${daemonUrl.replace(/\/$/, '')}/#${HASH_KEY}=${encodeURIComponent(code)}`
}

/**
 * Parse a pasted pairing link back into its parts, or null if it isn't one. Pure —
 * unit-tested. Lenient about surrounding whitespace (people paste with a trailing
 * newline) and about a missing trailing slash, strict about everything else: an
 * http(s) url and a non-empty code, or nothing.
 */
export function parsePairingLink(input: string): { url: string; code: string } | null {
  const trimmed = input.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  const code = new URLSearchParams(parsed.hash.replace(/^#/, '')).get(HASH_KEY)
  if (code === null || code.trim() === '') return null
  return { url: parsed.origin, code: code.trim() }
}

/**
 * The code in THIS page's url, if the client was opened from a pairing link. Reading it
 * is destructive by design: callers strip the hash immediately after (see the boot path)
 * so a single-use code doesn't sit in the address bar, history, or a screenshot.
 */
export function pairingCodeFromLocation(hash: string): string | null {
  const code = new URLSearchParams(hash.replace(/^#/, '')).get(HASH_KEY)
  return code === null || code.trim() === '' ? null : code.trim()
}
