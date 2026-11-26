import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { branchTracking } from '@porcelain/client/history/rules';
import { useReviewOverview } from '@/features/changes/index';
import {
  historyPlace,
  readHistory,
  readHistoryWindow,
} from '@porcelain/client/history';
import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useHistory(connection: Connection, scope: HistoryScope) {
  const history = readHistory({ connection, scope });
  const { result, value } = useConfirmedRead(
    readHistoryWindow({ connection, scope }),
  );
  const readMore = useAtomSet(history);
  const place = historyPlace({ connection, scope, kind: 'commits' });
  const selected = useAtomValue(place, (current) => current.selected);
  const setPlace = useAtomSet(place);
  return {
    ...value,
    result,
    selected,
    select: (selected: string) =>
      setPlace((current) => ({ ...current, selected })),
    readMore: () => readMore(undefined),
  };
}

export function useHistoryOverview(
  connection: Connection,
  scope: HistoryScope,
) {
  const history = useHistory(connection, scope);
  const overviewResult = useReviewOverview(scope, connection);
  const overview = Option.getOrUndefined(AsyncResult.value(overviewResult));
  return {
    history,
    overview,
    overviewPending: AsyncResult.isInitial(overviewResult),
    tracking: branchTracking(overview?.branch, history.snapshot),
  };
}
