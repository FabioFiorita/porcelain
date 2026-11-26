import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import {
  commentSelection,
  commentsRead,
  readComments,
} from '@porcelain/client/comments';
import type { Workspace } from '../../projects/index';

export type CommentOwner = Pick<Workspace, 'connection' | 'scope'>;

export function ownerSelection({ connection, scope }: CommentOwner) {
  return commentSelection(connection, scope);
}

export function useComments(owner: CommentOwner) {
  const atom = readComments(ownerSelection(owner));
  return {
    ...commentsRead(useAtomValue(atom)),
    refresh: useAtomRefresh(atom),
  };
}
