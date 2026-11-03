import { isAppPairingPath, pairingLink } from '@porcelain/contracts/access';

export type PairingCode = { code: string; environmentId: string };

export type RemoteLink = PairingCode & { address: string };

function webOrigin(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
    ? url.origin
    : undefined;
}

export function remoteLink(value: string): RemoteLink | undefined {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  const pairing = parsePairingLink(url.hash);
  if (!pairing) return undefined;
  if (url.pathname === '/pair') return { address: url.origin, ...pairing };
  if (!isAppPairingPath(url.pathname)) return undefined;
  const [first = ''] = (
    new URLSearchParams(url.hash.replace(/^#/, '')).get('a') ?? ''
  ).split(',');
  const address = webOrigin(first);
  return address === undefined ? undefined : { address, ...pairing };
}

export function pairingPageUrl(link: RemoteLink): string {
  return pairingLink({
    addresses: [link.address],
    code: link.code,
    environmentId: link.environmentId,
  });
}

export function parsePairingLink(fragment: string): PairingCode | null {
  const values = new URLSearchParams(fragment.replace(/^#/, ''));
  const code = values.get('c');
  const environmentId = values.get('e');
  return code && environmentId ? { code, environmentId } : null;
}
