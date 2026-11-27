import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import {
  commentSelection,
  commentsRead,
  readComments,
} from '@porcelain/client/comments';
import type { ReviewScope } from '@porcelain/client/changes/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export type CommentOwner = {
  scope: ReviewScope;
  context: ConnectionContext;
};

export function ownerSelection({ scope, context }: CommentOwner) {
  return commentSelection(context.connection, scope);
}

export function useComments(owner: CommentOwner) {
  const atom = readComments(ownerSelection(owner));
  return {
    ...commentsRead(useAtomValue(atom)),
    refresh: useAtomRefresh(atom),
  };
}
