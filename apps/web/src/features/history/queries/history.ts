import { readHistory, readHistoryWindow } from '@porcelain/client/history';
import { useAtomSet } from '@effect/atom-react';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useHistory(connection: Connection, scope: HistoryScope) {
  const history = readHistory({ connection, scope });
  const { result, value } = useConfirmedRead(
    readHistoryWindow({ connection, scope }),
  );
  const readMore = useAtomSet(history);
  return {
    ...value,
    result,
    readMore: () => readMore(undefined),
  };
}
