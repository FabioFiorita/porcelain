import { COMMENT_BODY_LENGTH } from '@porcelain/contracts/shared';
import { useAtom, useAtomSet } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { Exit } from 'effect';
import { commentCommands } from '@porcelain/client/reviews';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

function useCommentWrite<Input, A, E>(command: Atom.AtomResultFn<Input, A, E>) {
  const [result, submit] = useAtom(command, { mode: 'promiseExit' });
  return {
    result,
    send: (input: Input, onConfirmed?: () => void) => {
      void submit(input).then((exit) => {
        if (Exit.isSuccess(exit)) onConfirmed?.();
      });
    },
  };
}
export function useMarkCommentsSeen(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return useAtomSet(
    commentCommands({ scope, connection: context.connection }).seen,
  );
}
export function useCreateComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return {
    ...useCommentWrite(
      commentCommands({ scope, connection: context.connection }).create,
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
      commentCommands({ scope, connection: context.connection }).reply,
    ),
    bodyLimit: COMMENT_BODY_LENGTH,
  };
}
export function useResolveComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return useCommentWrite(
    commentCommands({ scope, connection: context.connection }).resolve,
  );
}
export function useEditComment(scope: ReviewScope, context: ConnectionContext) {
  return {
    ...useCommentWrite(
      commentCommands({ scope, connection: context.connection }).edit,
    ),
    bodyLimit: COMMENT_BODY_LENGTH,
  };
}
export function useDeleteComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return useCommentWrite(
    commentCommands({ scope, connection: context.connection }).remove,
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
