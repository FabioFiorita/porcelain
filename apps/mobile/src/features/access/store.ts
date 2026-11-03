import { useAtomMount, useAtomRef } from '@effect/atom-react';
import { AtomRef } from 'effect/reactivity';
import { accessState } from '../../shared/application/store';
import { pairingLinkArrival, receivePairingIntent } from './pairing-sheet';

const incomingPairingLink = AtomRef.make<string | undefined>(undefined);
const incomingPairingLinkArrival = pairingLinkArrival(incomingPairingLink);

export function receivePairingLink(path: string) {
  return receivePairingIntent(incomingPairingLink, path);
}

export function usePairingLinkArrival() {
  useAtomMount(incomingPairingLinkArrival);
}

export function useEnvironments() {
  return useAtomRef(accessState).remotes;
}

export function useEnvironmentStorageStatus() {
  const { status, error } = useAtomRef(accessState);
  return { status, error };
}

export function useMissingCredentials() {
  return useAtomRef(accessState).missingCredentials;
}
