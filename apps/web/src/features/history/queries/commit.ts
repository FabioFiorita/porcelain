import { commitQueryOptions } from '@porcelain/client/history';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { HistoryScope } from '../rules/connection';
import { type Connection } from '@/shared/workspace/connection';

export function useCommit(
  connection: Connection,
  scope: HistoryScope,
  oid: string,
  parent = 1,
) {
  return useSuspenseQuery(commitQueryOptions(scope, connection, oid, parent))
    .data;
}
