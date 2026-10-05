import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operationMutation } from '@/shared/query/mutation';
import { toggleLayerMark } from '@porcelain/client/reviews';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useToggleLayerMark(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const client = useQueryClient();
  const mutation = useMutation(
    operationMutation(
      (input: { layerId: string; fingerprint: string; reviewed: boolean }) =>
        toggleLayerMark(scope, context.connection, client, input),
      context.connection,
    ),
  );
  return {
    isPending: mutation.isPending,
    isError: mutation.isError,
    toggle: mutation.mutate,
  };
}
