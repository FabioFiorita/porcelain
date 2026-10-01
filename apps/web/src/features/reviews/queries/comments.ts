import {
  queryOptions,
  usePrefetchQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { ConnectionError } from '@/shared/api/connection-error';
import { queryKeys } from '@/shared/query/keys';
import type { ReviewScope } from '../rules/review';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { commentsApi } from '../api';

export function commentsQueryOptions(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  return queryOptions({
    queryKey: queryKeys.comments(context.connection.environmentId, scope),
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async ({ signal }) => {
      const request = { ...scope, ...context.connection.request(signal) };
      const result = await commentsApi(context.connection).list(request);
      request.signal.throwIfAborted();
      if (result.some((thread) => thread.worktreeId !== scope.worktreeId))
        throw new ConnectionError(
          'The comment context changed. Porcelain will update the discussion.',
        );
      return result;
    },
  });
}

export function useComments(scope: ReviewScope, context: ConnectionContext) {
  const query = useSuspenseQuery(commentsQueryOptions(scope, context));
  return { threads: query.data, error: query.error };
}

export function usePrefetchComments(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  usePrefetchQuery(commentsQueryOptions(scope, context));
}
