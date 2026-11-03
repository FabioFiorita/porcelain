import { remoteLink } from '@porcelain/client/access/rules/pairing-link';

const APP_PAIRING_PATH = '/open/pair';

function isAppPairingUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    (url.protocol === 'https:' || url.protocol === 'http:') &&
    url.pathname === APP_PAIRING_PATH
  );
}

export function pairingIntentPath(path: string): string {
  return isAppPairingUrl(path) ? APP_PAIRING_PATH : path;
}

export function incomingPairingLink(url: string | null): string | undefined {
  return url !== null && isAppPairingUrl(url) ? url : undefined;
}

export function scannedPairingLink(text: string): string | undefined {
  const link = text.trim();
  return remoteLink(link) === undefined ? undefined : link;
}
