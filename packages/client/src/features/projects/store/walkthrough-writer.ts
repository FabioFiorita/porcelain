import { Atom } from 'effect/reactivity';
import type { WriterSettings } from '../rules/walkthrough-writer.ts';

const nextWriters = Atom.family((_key: string) =>
  Atom.make<WriterSettings['writer'] | undefined>(undefined).pipe(
    Atom.keepAlive,
  ),
);

export function nextWalkthroughWriter(
  connection: { readonly environmentId: string },
  scope: { readonly projectId: string; readonly worktreeId: string },
) {
  return nextWriters(
    JSON.stringify([
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
    ]),
  );
}
