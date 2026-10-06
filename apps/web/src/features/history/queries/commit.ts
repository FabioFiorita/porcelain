import { readCommit } from '@porcelain/client/history';
import { useAtomSuspense } from '@effect/atom-react';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useCommit(
  connection: Connection,
  scope: HistoryScope,
  oid: string,
  parent = 1,
) {
  return useAtomSuspense(readCommit({ connection, scope, oid, parent })).value;
}
