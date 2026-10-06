import { readCommit } from '@porcelain/client/history';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useCommit(
  connection: Connection,
  scope: HistoryScope,
  oid: string,
  parent = 1,
) {
  return useConfirmedRead(readCommit({ connection, scope, oid, parent })).value;
}
