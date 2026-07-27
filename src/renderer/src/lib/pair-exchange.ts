/**
 * The client half of the pairing exchange: POST a code to a daemon's `/pair` and get
 * back a token. Shared by the browser client's auto-pair on boot and (via the shell)
 * the Mac app's paste-a-link flow.
 *
 * Kept out of `lib/daemon.ts` because it is NOT part of the session: it runs BEFORE the
 * client has any credential, against a url it was handed rather than the one it's bound
 * to. `content-type: application/json` is mandatory on the daemon side (it forces the
 * CORS preflight that keeps drive-by pages out), so it is not optional here either.
 *
 * The body also carries a `label` — this client's self-description for the daemon's device
 * roster. It is derived here rather than passed in so both callers get it for free; the
 * daemon sanitizes it and never uses it as an identifier, so there is nothing to override.
 */

import { deviceLabel } from './device-label'

/** Distinguishes the states a human acts on differently; anything else is a plain failure. */
export type PairFailure = 'expired' | 'invalid' | 'none' | 'unreachable'

export type PairOutcome = { ok: true; token: string } | { ok: false; reason: PairFailure }

/** How long to wait on a daemon that may be a tailnet hop away before giving up. */
const PAIR_TIMEOUT_MS = 8000

export async function exchangePairingCode(daemonUrl: string, code: string): Promise<PairOutcome> {
  let res: Response
  try {
    res = await fetch(`${daemonUrl.replace(/\/$/, '')}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, label: deviceLabel() }),
      signal: AbortSignal.timeout(PAIR_TIMEOUT_MS),
    })
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
  // 404 = no pairing window is open on that daemon (never started, already used, or
  // expired). To the human that's the same instruction: start pairing again over there.
  if (res.status === 404) return { ok: false, reason: 'none' }
  if (!res.ok) {
    let reason: PairFailure = 'invalid'
    try {
      const body = (await res.json()) as { error?: unknown }
      if (body.error === 'expired' || body.error === 'none') reason = body.error
    } catch {
      // Keep the default — a daemon that answered unparseably still refused us.
    }
    return { ok: false, reason }
  }
  try {
    const body = (await res.json()) as { token?: unknown }
    if (typeof body.token !== 'string' || body.token === '') {
      return { ok: false, reason: 'invalid' }
    }
    return { ok: true, token: body.token }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}
