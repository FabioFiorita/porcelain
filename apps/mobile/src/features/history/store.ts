import { Atom } from 'effect/reactivity';

export const besideCommit = Atom.family((_workspace: string) =>
  Atom.make<string | undefined>(undefined).pipe(Atom.keepAlive),
);
