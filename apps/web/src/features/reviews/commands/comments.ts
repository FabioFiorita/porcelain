import { useId } from 'react';
import { COMMENT_BODY_LENGTH } from '@porcelain/contracts/shared';
import { useAtom, useAtomMount } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { commentWriteBinding } from '@porcelain/client/reviews';
import {
  commentCommands,
  reviewCommands,
  observeCommentVisibility,
} from '@porcelain/client/reviews';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

function useCommentWrite<Input, A, E>(command: Atom.AtomResultFn<Input, A, E>) {
  return commentWriteBinding(useAtom(command, { mode: 'promiseExit' }));
}
export function useVisibleComments(
  scope: ReviewScope,
  context: ConnectionContext,
  filter: 'open' | 'resolved' | undefined,
) {
  const owner = useId();
  useAtomMount(
    observeCommentVisibility({
      connection: context.connection,
      scope,
      owner,
      filter,
    }),
  );
}
export function useCreateComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return {
    ...useCommentWrite(
      scope.review
        ? reviewCommands({
            reviewId: scope.review.reviewId,
            connection: context.connection,
          }).createComment
        : commentCommands({ scope, connection: context.connection }).create,
    ),
    bodyLimit: COMMENT_BODY_LENGTH,
  };
}
export function useReplyComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return {
    ...useCommentWrite(
      scope.review
        ? reviewCommands({
            reviewId: scope.review.reviewId,
            connection: context.connection,
          }).reply
        : commentCommands({ scope, connection: context.connection }).reply,
    ),
    bodyLimit: COMMENT_BODY_LENGTH,
  };
}
export function useResolveComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return useCommentWrite(
    scope.review
      ? reviewCommands({
          reviewId: scope.review.reviewId,
          connection: context.connection,
        }).resolve
      : commentCommands({ scope, connection: context.connection }).resolve,
  );
}
export function useEditComment(scope: ReviewScope, context: ConnectionContext) {
  return {
    ...useCommentWrite(
      scope.review
        ? reviewCommands({
            reviewId: scope.review.reviewId,
            connection: context.connection,
          }).edit
        : commentCommands({ scope, connection: context.connection }).edit,
    ),
    bodyLimit: COMMENT_BODY_LENGTH,
  };
}
export function useDeleteComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return useCommentWrite(
    scope.review
      ? reviewCommands({
          reviewId: scope.review.reviewId,
          connection: context.connection,
        }).deleteComment
      : commentCommands({ scope, connection: context.connection }).remove,
  );
}
export function useDeleteResolvedComments(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const [result, send] = useAtom(
    commentCommands({ scope, connection: context.connection }).removeResolved,
  );
  return { result, send, reset: () => send(Atom.Reset) };
}
