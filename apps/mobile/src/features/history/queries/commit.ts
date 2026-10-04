import { useQuery } from '@tanstack/react-query';
import { commitQueryOptions } from '@porcelain/client/history';
import type { useHistory } from './history';

type HistoryWorkspace = Parameters<typeof useHistory>[0];

export function useCommit(
  { connection, scope }: HistoryWorkspace,
  oid: string,
  parent: number,
) {
  const query = useQuery(commitQueryOptions(scope, connection, oid, parent));
  return {
    data: query.data,
    isPending: query.isPending,
    error: query.error,
    read: () => {
      void query.refetch();
    },
  };
}
