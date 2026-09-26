import { ConnectionError } from '@/shared/api/connection-error';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewScope } from '@/features/review/model/review';
import { queryKeys } from '@/shared/query/keys';
import { useConnectedContext } from '@/app/workspace-provider';

export function usePublishedReview(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return useQuery({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'review',
    ]),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const review = await api.review.review({ ...scope, ...request });
      request.signal.throwIfAborted();
      if (
        review &&
        (review.worktreeId !== scope.worktreeId ||
          review.environmentId !== connection.environmentId)
      )
        throw new ConnectionError(
          'The review context changed. Reopen Porcelain to continue safely.',
        );
      return review;
    },
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    throwOnError: false,
  });
}

export function useLayerMarks(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  const client = useQueryClient();
  const key = queryKeys.reviewSurface(connection.environmentId, scope, [
    'reviewed-layers',
  ]);
  const marks = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const result = await api.review.reviewedLayers.list({
        ...scope,
        ...request,
      });
      request.signal.throwIfAborted();
      return result;
    },
    throwOnError: false,
  });
  const toggle = useMutation({
    mutationFn: async (input: {
      layerId: string;
      fingerprint: string;
      reviewed: boolean;
    }) => {
      const request = connection.request();
      const result = input.reviewed
        ? await api.review.reviewedLayers.remove({
            ...scope,
            ...request,
            layerId: input.layerId,
          })
        : await api.review.reviewedLayers.set({
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
  return { marks, toggle };
}
