import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { useQueries } from '@tanstack/react-query';
import type { Inventory } from '../domain/inventory';
import type { ReviewSummary } from '../domain/review';
import { queryKeys } from './keys';
import { useConnectedContext } from './workspace-provider';

const pendingSummaries = new WeakMap<object, Promise<void>>();

function readInBackground<T>(
  connection: object,
  signal: AbortSignal,
  read: () => Promise<T>,
): Promise<T> {
  const previous = pendingSummaries.get(connection) ?? Promise.resolve();
  const result = previous.then(() => {
    signal.throwIfAborted();
    return read();
  });
  const settled = result.then(
    () => undefined,
    () => undefined,
  );
  pendingSummaries.set(connection, settled);
  void settled.then(() => {
    if (pendingSummaries.get(connection) === settled)
      pendingSummaries.delete(connection);
  });
  return result;
}

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
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        readInBackground(connection, signal, async () => {
          const request = connection.request(signal);
          const data = await api.review.summary({ ...scope, ...request });
          request.signal.throwIfAborted();
          if (data.worktreeId !== scope.worktreeId)
            throw new ConnectionError('The review context changed.');
          return data;
        }),
      staleTime: 30000,
      refetchOnWindowFocus: true,
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
