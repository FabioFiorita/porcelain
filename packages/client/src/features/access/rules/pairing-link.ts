export type PairingCode = { code: string; environmentId: string };

export type RemoteLink = PairingCode & { address: string };

export function remoteLink(value: string): RemoteLink | undefined {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.pathname !== '/pair'
  )
    return undefined;
  const pairing = parsePairingLink(url.hash);
  return pairing ? { address: url.origin, ...pairing } : undefined;
}

export function parsePairingLink(fragment: string): PairingCode | null {
  const values = new URLSearchParams(fragment.replace(/^#/, ''));
  const code = values.get('c');
  const environmentId = values.get('e');
  return code && environmentId ? { code, environmentId } : null;
}
