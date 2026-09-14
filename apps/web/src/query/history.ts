import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { useConnectedContext } from './workspace-provider';

/**
 * Read the checked-out branch history one cursor page at a time. Loaded pages
 * stay in one query so the navigation never drops newer commits while older
 * history is fetched.
 */
export function useHistory(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  const query = useSuspenseInfiniteQuery({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'history',
    ]),
    queryFn: async ({ signal, pageParam }) => {
      const request = connection.request(signal);
      const page = await api.review.history({
        ...scope,
        ...request,
        ...(pageParam == null ? {} : { cursor: pageParam }),
      });
      request.signal.throwIfAborted();
      return page;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    select: (data) => {
      const first = data.pages[0];
      const last = data.pages.at(-1);
      return {
        snapshot: first?.snapshot,
        commits: data.pages.flatMap((page) => page.commits),
        nextCursor: last?.nextCursor ?? null,
        boundary: last?.boundary ?? null,
      };
    },
  });

  return {
    ...query.data,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    fetchNextPage: query.fetchNextPage,
  };
}
