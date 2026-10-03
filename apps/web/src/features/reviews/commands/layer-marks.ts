import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { layerMarksQueryOptions } from '@porcelain/client/reviews';
import type { ReviewScope } from '../rules/review';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { reviewsApi } from '../api';

export function useToggleLayerMark(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const { connection } = context;
  const client = useQueryClient();
  const key = layerMarksQueryOptions(scope, context.connection).queryKey;
  const mutation = useMutation({
    mutationFn: async (input: {
      layerId: string;
      fingerprint: string;
      reviewed: boolean;
    }) => {
      const request = connection.request();
      const result = input.reviewed
        ? await reviewsApi(connection).reviewedLayers.remove({
            ...scope,
            ...request,
            layerId: input.layerId,
          })
        : await reviewsApi(connection).reviewedLayers.set({
            ...scope,
            ...request,
            input: {
              layerId: input.layerId,
              fingerprint: input.fingerprint,
              reviewed: true,
            },
          });
      request.signal.throwIfAborted();
      return result;
    },
    onSuccess: (result) => {
      client.setQueryData(key, result);
      void client.invalidateQueries({
        queryKey: queryKeys.inventory(connection.environmentId),
      });
    },
  });
  return {
    isPending: mutation.isPending,
    isError: mutation.isError,
    toggle: mutation.mutate,
  };
}
