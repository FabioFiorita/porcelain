import { commitQueryOptions } from '@porcelain/client/history';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { HistoryScope } from '../rules/connection';
import { type Connection } from '@/shared/workspace/connection';

export function useCommit(
  connection: Connection | null,
  scope: HistoryScope,
  oid: string,
  parent = 1,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useSuspenseQuery(commitQueryOptions(scope, connection, oid, parent))
    .data;
}
