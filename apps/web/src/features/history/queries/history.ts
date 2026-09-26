import type { ListCommitsResponse } from '@porcelain/contracts/changes';
import {
  infiniteQueryOptions,
  type InfiniteData,
  useSuspenseInfiniteQuery,
} from '@tanstack/react-query';
import { discardRejection } from '@/shared/lib/submit-form';
import { historyApi } from '../api';
import type { HistoryConnection, HistoryScope } from '../rules/connection';

type Continuation = { after: string[]; tip: string };

function selectHistory(
  data: InfiniteData<ListCommitsResponse, Continuation | undefined>,
) {
  const restartedAt = data.pages.findLastIndex((page) => page.restarted);
  const pages = restartedAt === -1 ? data.pages : data.pages.slice(restartedAt);
  const last = pages.at(-1);
  return {
    snapshot: pages[0]?.snapshot ?? null,
    commits: pages.flatMap((page) => page.commits),
    nextAfter: last?.nextAfter ?? null,
    boundary: last?.boundary ?? null,
    restarted: last?.restarted ?? false,
  };
}

function historyQueryOptions(
  environmentId: string,
  scope: HistoryScope,
  request: (signal?: AbortSignal) => { signal: AbortSignal },
) {
  return infiniteQueryOptions<
    ListCommitsResponse,
    Error,
    ReturnType<typeof selectHistory>,
    readonly ['review', string, string, string, 'history'],
    Continuation | undefined
  >({
    queryKey: [
      'review',
      environmentId,
      scope.projectId,
      scope.worktreeId,
      'history',
    ],
    queryFn: async ({ signal, pageParam }) => {
      const connected = request(signal);
      const page = await historyApi.list(
        connected.signal,
        scope.worktreeId,
        pageParam?.after,
        pageParam?.tip,
      );
      connected.signal.throwIfAborted();
      return page;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialPageParam: undefined,
    getNextPageParam: (page): Continuation | undefined =>
      page.nextAfter && page.tip
        ? { after: page.nextAfter, tip: page.tip }
        : undefined,
    select: selectHistory,
  });
}

export function useHistory(
  connection: HistoryConnection | null,
  scope: HistoryScope,
) {
  if (!connection) throw new Error('A connected environment is required');
  const query = useSuspenseInfiniteQuery(
    historyQueryOptions(connection.environmentId, scope, connection.request),
  );
  return {
    ...query.data,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    loadNextPage: () => discardRejection(query.fetchNextPage()),
  };
}
