import { historyQueryOptions } from '@porcelain/client/history';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { discardRejection } from '@/shared/lib/submit-form';
import type { HistoryScope } from '../rules/connection';
import { type Connection } from '@/shared/workspace/connection';

export function useHistory(connection: Connection, scope: HistoryScope) {
  const query = useSuspenseInfiniteQuery(
    historyQueryOptions(scope, connection),
  );
  return {
    ...query.data,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    loadNextPage: () => discardRejection(query.fetchNextPage()),
  };
}
