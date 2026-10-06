import { readHistory, readHistoryWindow } from '@porcelain/client/history';
import { useAtomSet, useAtomSuspense } from '@effect/atom-react';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useHistory(connection: Connection, scope: HistoryScope) {
  const history = readHistory({ connection, scope });
  const result = useAtomSuspense(readHistoryWindow({ connection, scope }), {
    includeFailure: true,
  });
  const readMore = useAtomSet(history);
  const value = Option.getOrElse(AsyncResult.value(result), () => {
    if (AsyncResult.isFailure(result)) throw Cause.squash(result.cause);
    throw new Error('History has no confirmed page');
  });
  return {
    ...value,
    result,
    readMore: () => readMore(undefined),
  };
}
