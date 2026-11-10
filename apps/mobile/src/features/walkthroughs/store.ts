import { Atom } from 'effect/reactivity';

export const walkthroughDraft = Atom.family((_key: string) =>
  Atom.make('').pipe(Atom.keepAlive),
);

export const walkthroughAsking = Atom.family((_key: string) =>
  Atom.make(false).pipe(Atom.keepAlive),
);

export const walkthroughReadingOffset = Atom.family((_key: string) =>
  Atom.make(0).pipe(Atom.keepAlive),
);
