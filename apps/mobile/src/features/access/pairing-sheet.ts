import { Atom } from 'effect/reactivity';
import {
  useAtom,
  useAtomMount,
  useAtomSet,
  useAtomValue,
} from '@effect/atom-react';
import { pairingIntentPath } from './rules/pairing-link-intake';

type IncomingLink = {
  readonly value: string | undefined;
  set: (link: string | undefined) => unknown;
};

export function receivePairingIntent(incoming: IncomingLink, path: string) {
  const target = pairingIntentPath(path);
  if (target !== path) incoming.set(path);
  return target;
}

export const pairingSheetLink = Atom.make('').pipe(Atom.keepAlive);

export const pairingSheetSession = Atom.make((get) => {
  const registry = get.registry;
  get.addFinalizer(() => registry.set(pairingSheetLink, ''));
});

export function pairingLinkArrival(incoming: IncomingLink) {
  return Atom.make((get) => {
    const link = incoming.value ?? '';
    incoming.set(undefined);
    get.set(pairingSheetLink, link);
  }).pipe(Atom.setIdleTTL(0));
}

export const pairingScanAccepted = Atom.make(false).pipe(Atom.setIdleTTL(0));

export const acceptScannedPairingLink = Atom.fnSync((link: string, get) => {
  if (get(pairingScanAccepted)) return;
  get.set(pairingScanAccepted, true);
  get.set(pairingSheetLink, link);
});

export function usePairingSheetLink() {
  useAtomMount(pairingSheetSession);
  return useAtom(pairingSheetLink);
}

export function useScannedPairingLink() {
  return {
    accepted: useAtomValue(pairingScanAccepted),
    accept: useAtomSet(acceptScannedPairingLink),
  };
}
