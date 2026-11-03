import {
  APP_PAIRING_PATH,
  isAppPairingPath,
} from '@porcelain/contracts/access';
import { remoteLink } from '@porcelain/client/access/rules/pairing-link';

function routedPath(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  return url.protocol === 'https:' || url.protocol === 'http:'
    ? url.pathname
    : `/${url.host}${url.pathname}`;
}

export function pairingIntentPath(path: string): string {
  const routed = routedPath(path);
  return routed !== undefined && isAppPairingPath(routed)
    ? APP_PAIRING_PATH
    : path;
}

export function scannedPairingLink(text: string): string | undefined {
  const link = text.trim();
  return remoteLink(link) === undefined ? undefined : link;
}
