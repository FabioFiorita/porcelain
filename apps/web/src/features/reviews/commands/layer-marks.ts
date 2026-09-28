import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { layerMarksQueryOptions } from '../queries/published-review';
import type { ReviewScope } from '../rules/review';
import type { ReviewsContext } from '../rules/reviewed';

export function useToggleLayerMark(
  scope: ReviewScope,
  context: ReviewsContext,
) {
  const { api, connection } = context;
  const client = useQueryClient();
  const key = layerMarksQueryOptions(scope, context).queryKey;
  const mutation = useMutation({
    mutationFn: async (input: {
      layerId: string;
      fingerprint: string;
      reviewed: boolean;
    }) => {
      const request = connection.request();
      const result = input.reviewed
        ? await api.reviews.reviewedLayers.remove({
            ...scope,
            ...request,
            layerId: input.layerId,
          })
        : await api.reviews.reviewedLayers.set({
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
