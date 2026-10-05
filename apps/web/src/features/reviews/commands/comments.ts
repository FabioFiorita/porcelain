import { COMMENT_BODY_LENGTH } from '@porcelain/contracts/shared';
import {
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { commentCommands } from '@porcelain/client/reviews';
import { asMutation, operationMutation } from '@/shared/query/mutation';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

function useCommentCommands(scope: ReviewScope, context: ConnectionContext) {
  return commentCommands(scope, context.connection, useQueryClient());
}

function withSend<TData, TVariables extends object>(
  mutation: UseMutationResult<TData, Error, TVariables>,
) {
  return {
    ...asMutation(mutation),
    send: mutation.mutate,
  };
}

export function useMarkCommentsSeen(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const commands = useCommentCommands(scope, context);
  return useMutation(operationMutation(commands.seen, context.connection));
}
export function useCreateComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const commands = useCommentCommands(scope, context);
  return {
    ...withSend(
      useMutation(operationMutation(commands.create, context.connection)),
    ),
    bodyLimit: COMMENT_BODY_LENGTH,
  };
}
export function useReplyComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const commands = useCommentCommands(scope, context);
  return {
    ...withSend(
      useMutation(operationMutation(commands.reply, context.connection)),
    ),
    bodyLimit: COMMENT_BODY_LENGTH,
  };
}
export function useResolveComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const commands = useCommentCommands(scope, context);
  return withSend(
    useMutation(operationMutation(commands.resolve, context.connection)),
  );
}
export function useEditComment(scope: ReviewScope, context: ConnectionContext) {
  const commands = useCommentCommands(scope, context);
  return {
    ...withSend(
      useMutation(operationMutation(commands.edit, context.connection)),
    ),
    bodyLimit: COMMENT_BODY_LENGTH,
  };
}
export function useDeleteComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const commands = useCommentCommands(scope, context);
  return withSend(
    useMutation(operationMutation(commands.remove, context.connection)),
  );
}
export function useDeleteResolvedComments(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const commands = useCommentCommands(scope, context);
  const mutation = useMutation(
    operationMutation(commands.removeResolved, context.connection),
  );
  return { ...withSend(mutation), result: mutation.data };
}
