import { Atom } from 'effect/reactivity';

export const projectFolder = Atom.make<string | undefined>(undefined);

export const navigatorView = Atom.make<'worktrees' | 'reviews'>(
  'worktrees',
).pipe(Atom.keepAlive);
