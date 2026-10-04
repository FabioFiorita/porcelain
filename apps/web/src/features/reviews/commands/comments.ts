import { COMMENT_BODY_LENGTH } from '@porcelain/contracts/shared';
import {
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { commentCommands } from '@porcelain/client/reviews';
import { asMutation } from '@/shared/query/mutation';
import type { ReviewScope } from '../rules/review';
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
  return useMutation({ mutationFn: commands.seen });
}
export function useCreateComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const commands = useCommentCommands(scope, context);
  return {
    ...withSend(useMutation({ mutationFn: commands.create })),
    bodyLimit: COMMENT_BODY_LENGTH,
  };
}
export function useReplyComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const commands = useCommentCommands(scope, context);
  return {
    ...withSend(useMutation({ mutationFn: commands.reply })),
    bodyLimit: COMMENT_BODY_LENGTH,
  };
}
export function useResolveComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const commands = useCommentCommands(scope, context);
  return withSend(useMutation({ mutationFn: commands.resolve }));
}
export function useEditComment(scope: ReviewScope, context: ConnectionContext) {
  const commands = useCommentCommands(scope, context);
  return {
    ...withSend(useMutation({ mutationFn: commands.edit })),
    bodyLimit: COMMENT_BODY_LENGTH,
  };
}
export function useDeleteComment(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const commands = useCommentCommands(scope, context);
  return withSend(useMutation({ mutationFn: commands.remove }));
}
export function useDeleteResolvedComments(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const commands = useCommentCommands(scope, context);
  const mutation = useMutation({ mutationFn: commands.removeResolved });
  return { ...withSend(mutation), result: mutation.data };
}
