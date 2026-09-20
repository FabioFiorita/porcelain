import type { PairingCode } from './port';

/**
 * Read the pairing code out of the address bar and erase it, before anything
 * else in the application runs.
 *
 * This module has a side effect on import on purpose: the fragment has to be
 * gone before the first render, before any navigation, and before anything
 * that could copy the URL. It is imported for that effect, and the value is
 * kept in memory only.
 *
 * What this protects: the code never reaches the browser's history entry,
 * never survives a reload, and cannot be read back from `location` by later
 * code or an extension reading the address bar. What it does not protect: the
 * link itself, wherever the owner received it, and anything that already read
 * the URL before this ran. A fragment is never sent to the server, so it was
 * never in a request line, an access log or a `Referer` header to begin with.
 */
export function takePairingCode(): PairingCode | null {
  if (typeof window === 'undefined') return null;
  const fragment = window.location.hash.replace(/^#/, '');
  if (fragment === '') return null;
  const values = new URLSearchParams(fragment);
  const code = values.get('c');
  const environmentId = values.get('e');
  // Replace, never push: a back navigation must not restore the fragment.
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
  if (!code || !environmentId) return null;
  return { code, environmentId };
}

let taken = takePairingCode();

/**
 * The code this page was opened with, if any — handed out exactly once.
 *
 * A grant is consumed by redeeming it, so a second attempt with the same code
 * always fails. Reading it once means a back navigation to this route finds
 * nothing to retry, instead of spending a link the owner still holds.
 */
export function pairingCode(): PairingCode | null {
  const code = taken;
  taken = null;
  return code;
}
