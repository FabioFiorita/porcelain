import { readFileTimeline } from '@porcelain/client/history';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useFileTimeline(
  connection: Connection,
  scope: HistoryScope,
  path: string,
) {
  return useConfirmedRead(readFileTimeline({ connection, scope, path })).value;
}
