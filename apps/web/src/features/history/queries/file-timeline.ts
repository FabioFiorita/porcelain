import { readFileTimeline } from '@porcelain/client/history';
import { useAtomSuspense } from '@effect/atom-react';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useFileTimeline(
  connection: Connection,
  scope: HistoryScope,
  path: string,
) {
  return useAtomSuspense(readFileTimeline({ connection, scope, path })).value;
}
