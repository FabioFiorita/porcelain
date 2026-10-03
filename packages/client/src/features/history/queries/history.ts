import type { ListCommitsResponse } from '@porcelain/contracts/changes';
import type { QueryFunctionContext, InfiniteData } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { historyApi } from '../api.ts';

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

export function historyQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'history',
      ...(connection.cacheIdentity ?? []),
    ],
    queryFn: async ({
      signal,
      pageParam,
    }: Pick<QueryFunctionContext, 'signal'> & {
      pageParam: Continuation | undefined;
    }) => {
      const connected = connection.request(signal);
      const page = await historyApi(connection).list({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        after: pageParam?.after,
        tip: pageParam?.tip,
      });
      connected.signal.throwIfAborted();
      return page;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialPageParam: undefined as Continuation | undefined,
    getNextPageParam: (page: ListCommitsResponse): Continuation | undefined =>
      page.nextAfter && page.tip
        ? { after: page.nextAfter, tip: page.tip }
        : undefined,
    select: selectHistory,
  };
}
