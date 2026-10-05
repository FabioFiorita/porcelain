import { commentsQueryOptions } from '@porcelain/client/reviews';
import { usePrefetchQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function useComments(scope: ReviewScope, context: ConnectionContext) {
  const query = useSuspenseQuery(
    commentsQueryOptions(scope, context.connection),
  );
  return { threads: query.data, error: query.error };
}

export function usePrefetchComments(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  usePrefetchQuery(commentsQueryOptions(scope, context.connection));
}
