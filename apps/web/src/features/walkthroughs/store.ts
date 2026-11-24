import { Atom } from 'effect/reactivity';

export const walkthroughDraft = Atom.family((_key: string) =>
  Atom.make('').pipe(Atom.keepAlive),
);
