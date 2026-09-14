import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { useQueries } from '@tanstack/react-query';
import type { Inventory } from '../domain/inventory';
import type { ReviewSummary } from '../domain/review';
import { queryKeys } from './keys';
import { useConnectedContext } from './workspace-provider';

export function useReviewSummaries(inventory: Inventory) {
  const { api, connection } = useConnectedContext();
  const scopes = inventory.projects.flatMap((project) =>
    project.worktrees
      .filter((worktree) => worktree.available)
      .map((worktree) => ({ projectId: project.id, worktreeId: worktree.id })),
  );
  const queries = useQueries({
    queries: scopes.map((scope) => ({
      queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
        'summary',
      ]),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const request = connection.request(signal);
        const data = await api.review.summary({ ...scope, ...request });
        request.signal.throwIfAborted();
        if (data.worktreeId !== scope.worktreeId)
          throw new ConnectionError('The review context changed.');
        return data;
      },
      staleTime: 30000,
      retry: false,
      throwOnError: false,
    })),
  });
  return {
    pending: queries.some((query) => query.isPending),
    summaries: new Map<string, ReviewSummary>(
      queries.flatMap((query) =>
        query.data ? [[query.data.worktreeId, query.data]] : [],
      ),
    ),
  };
}
