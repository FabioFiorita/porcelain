import { useInfiniteQuery } from '@tanstack/react-query';
import { historyQueryOptions } from '@porcelain/client/history';
import type { WorktreeConnection } from '@porcelain/client/transport';

export type HistoryWorkspace = {
  connection: WorktreeConnection;
  scope: { projectId: string; worktreeId: string };
};

export function useHistory({ connection, scope }: HistoryWorkspace) {
  const query = useInfiniteQuery(historyQueryOptions(scope, connection));
  return {
    data: query.data,
    isPending: query.isPending,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    read: () => {
      void query.refetch();
    },
    loadMore: () => {
      void query.fetchNextPage();
    },
  };
}
