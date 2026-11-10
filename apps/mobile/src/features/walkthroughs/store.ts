import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';

export const walkthroughDraft = Atom.family((_key: string) =>
  Atom.make('').pipe(Atom.keepAlive),
);

export const walkthroughAsking = Atom.family((_key: string) =>
  Atom.make(false).pipe(Atom.keepAlive),
);

const walkthroughReadingOffset = Atom.family((_key: string) =>
  Atom.make(0).pipe(Atom.keepAlive),
);

const walkthroughOpeningOffset = Atom.family((key: string) =>
  Atom.make((get) => get.once(walkthroughReadingOffset(key))).pipe(
    Atom.setIdleTTL(0),
  ),
);

export function useWalkthroughOffset(key: string) {
  return {
    initial: useAtomValue(walkthroughOpeningOffset(key)),
    remember: useAtomSet(walkthroughReadingOffset(key)),
  };
}
