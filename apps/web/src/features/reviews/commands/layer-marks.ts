import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toggleLayerMark } from '@porcelain/client/reviews';
import type { ReviewScope } from '../rules/review';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useToggleLayerMark(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: {
      layerId: string;
      fingerprint: string;
      reviewed: boolean;
    }) => toggleLayerMark(scope, context.connection, client, input),
  });
  return {
    isPending: mutation.isPending,
    isError: mutation.isError,
    toggle: mutation.mutate,
  };
}
