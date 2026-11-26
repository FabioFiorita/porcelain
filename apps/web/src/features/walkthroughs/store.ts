import { Atom } from 'effect/reactivity';
import type { WriterSettings } from '@porcelain/client/projects/rules';

export const nextWalkthroughWriter = Atom.family((_worktree: string) =>
  Atom.make<WriterSettings['writer'] | undefined>(undefined).pipe(
    Atom.keepAlive,
  ),
);
