import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { useConnectedContext } from './workspace-provider';

type Continuation = { after: string[]; tip: string };

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
        ...(pageParam == null
          ? {}
          : { after: pageParam.after, tip: pageParam.tip }),
      });
      request.signal.throwIfAborted();
      return page;
    },
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: false as const,
    initialPageParam: undefined as Continuation | undefined,
    getNextPageParam: (page) =>
      page.nextAfter && page.tip
        ? { after: page.nextAfter, tip: page.tip }
        : undefined,
    select: (data) => {
      const restartedAt = data.pages.findLastIndex((page) => page.restarted);
      const pages =
        restartedAt === -1 ? data.pages : data.pages.slice(restartedAt);
      const last = pages.at(-1);
      return {
        snapshot: pages[0]?.snapshot ?? null,
        commits: pages.flatMap((page) => page.commits),
        nextAfter: last?.nextAfter ?? null,
        boundary: last?.boundary ?? null,
        restarted: last?.restarted ?? false,
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
