import { Effect, Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { CommentsResponse } from '@porcelain/contracts/comments';
import type {
  RuntimeConnection,
  WorktreeSelection,
} from '../../../shared/api/connection.ts';
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

export function commentSelection(
  connection: RuntimeConnection,
  scope: { readonly projectId: string; readonly worktreeId: string },
): WorktreeSelection {
  return {
    connection,
    scope: { projectId: scope.projectId, worktreeId: scope.worktreeId },
  };
}

export function commentsRead<E>(
  result: AsyncResult.AsyncResult<CommentsResponse, E>,
) {
  return {
    view: Option.getOrUndefined(AsyncResult.value(result)),
    failed: AsyncResult.isFailure(result),
    waiting: result.waiting,
  };
}
