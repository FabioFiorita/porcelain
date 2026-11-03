import { pairingIntentPath } from '../features/access';

export function redirectSystemPath({ path }: { path: string }) {
  return pairingIntentPath(path);
}
