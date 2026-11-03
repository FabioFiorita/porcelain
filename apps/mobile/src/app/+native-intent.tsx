import { clearInitialURL } from 'expo-linking';
import { receivePairingLink } from '../features/access';

export function redirectSystemPath({ path }: { path: string }) {
  const target = receivePairingLink(path);
  if (target !== path) clearInitialURL();
  return target;
}
