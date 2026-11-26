import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { retainRead, worktreeRead } from '../../../shared/api/worktree-read.ts';

const readCommentsSnapshot = Effect.fn('Comments.read')(function* ({
  connection,
  scope,
}: WorktreeSelection) {
  return yield* requestApi(connection, (api) =>
    api.comments.listComments({ params: { worktreeId: scope.worktreeId } }),
  );
});

export const readComments = Atom.family((selection: WorktreeSelection) =>
  worktreeRead(
    selection.connection,
    selection.scope,
    ['comments'],
    readCommentsSnapshot(selection),
    clientRuntime(selection.connection),
  ).pipe(retainRead),
);
