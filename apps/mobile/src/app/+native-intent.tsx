import { clearInitialURL } from 'expo-linking';
import { receivePairingLink } from '../features/access';
import { tabRootPath } from '../shared/rules/tab-href';

export function redirectSystemPath({ path }: { path: string }) {
  const target = receivePairingLink(path);
  if (target !== path) clearInitialURL();
  return tabRootPath(target);
}
