import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { useConnectedContext } from './workspace-provider';

/** Where a walk had got to, and the commit the list started at. */
type Continuation = { after: string[]; tip: string };

/**
 * The checked-out branch's history, a page at a time.
 *
 * A page is continued from the frontier of the walk that produced it, so a
 * page already read never shifts when commits arrive at the top, no branch
 * beside the one that ended the page is lost, and nothing has to be kept on
 * the server for a reader to come back to.
 *
 * Focus does not reload it. An infinite query refetches every page it holds,
 * which for a reader three pages down was a few hundred Git processes for
 * history that had not changed. Step 6 brings the notice that says when it
 * actually did.
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
      // A page whose history had been rewritten answers with the top of the
      // history that exists now. It replaces what came before it rather than
      // continuing it, so the pages above it are dropped.
      const restartedAt = data.pages.findLastIndex((page) => page.restarted);
      const pages =
        restartedAt === -1 ? data.pages : data.pages.slice(restartedAt);
      const last = pages.at(-1);
      return {
        snapshot: pages[0]?.snapshot ?? null,
        commits: pages.flatMap((page) => page.commits),
        nextAfter: last?.nextAfter ?? null,
        boundary: last?.boundary ?? null,
        // The notice belongs to the page that restarted, not to the list
        // forever: reading on past it is what says the reader has seen it.
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
