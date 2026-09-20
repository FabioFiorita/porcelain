import type { PairingCode } from './port';

/** Read a pairing link's fragment, wherever the link came from. */
function readPairingLink(link: string): PairingCode | null {
  let values: URLSearchParams;
  try {
    values = new URLSearchParams(new URL(link).hash.replace(/^#/, ''));
  } catch {
    return null;
  }
  const code = values.get('c');
  const environmentId = values.get('e');
  return code && environmentId ? { code, environmentId } : null;
}

/**
 * Ask the development server for a pairing link of this browser's own.
 *
 * Each call mints a fresh single-use grant, so two browser contexts never
 * share a credential and nothing reusable exists to be copied out of a
 * manifest or a console.
 */
export async function requestPlaygroundLink(
  signal = AbortSignal.timeout(5000),
): Promise<PairingCode> {
  const response = await fetch('/__porcelain/playground', {
    method: 'POST',
    headers: { 'x-porcelain-playground': '1' },
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal,
  });
  if (!response.ok) throw new Error('The playground issued no pairing link.');
  const value: unknown = await response.json();
  const link =
    value && typeof value === 'object' && 'link' in value ? value.link : null;
  const parsed = typeof link === 'string' ? readPairingLink(link) : null;
  if (!parsed) throw new Error('The playground issued an unusable link.');
  return parsed;
}
