import { Atom } from 'effect/reactivity';
import { useAtom, useAtomMount, useAtomSet } from '@effect/atom-react';

export const pairingSheetLink = Atom.make('').pipe(Atom.keepAlive);

export const pairingSheetSession = Atom.make((get) => {
  const registry = get.registry;
  get.addFinalizer(() => registry.set(pairingSheetLink, ''));
});

export const pairingLinkArrival = Atom.family((link: string) =>
  Atom.make((get) => {
    get.set(pairingSheetLink, link);
  }),
);

export function usePairingSheetLink() {
  useAtomMount(pairingSheetSession);
  return useAtom(pairingSheetLink);
}

export function useOfferPairingLink() {
  return useAtomSet(pairingSheetLink);
}

export function usePairingLinkArrival(link: string) {
  useAtomMount(pairingLinkArrival(link));
}
