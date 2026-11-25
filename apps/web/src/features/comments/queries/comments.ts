import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readComments } from '@porcelain/client/comments';
import type { ReviewScope } from '@porcelain/client/changes/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export type CommentOwner = {
  scope: ReviewScope;
  context: ConnectionContext;
};

export function commentSelection({ scope, context }: CommentOwner) {
  return {
    connection: context.connection,
    scope: { projectId: scope.projectId, worktreeId: scope.worktreeId },
  };
}

export function useComments(owner: CommentOwner) {
  const atom = readComments(commentSelection(owner));
  const result = useAtomValue(atom);
  return {
    view: Option.getOrUndefined(AsyncResult.value(result)),
    failed: AsyncResult.isFailure(result),
    refresh: useAtomRefresh(atom),
  };
}
