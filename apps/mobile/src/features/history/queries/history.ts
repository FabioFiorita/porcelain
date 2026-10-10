import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import {
  readCommit,
  readHistory,
  readHistoryWindow,
} from '@porcelain/client/history';
import { readCommitDiffs } from '@porcelain/client/changes';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';

export type HistorySelection = {
  connection: RuntimeConnection;
  scope: HistoryScope;
};

export function useHistory(selection: HistorySelection) {
  const query = readHistory(selection);
  const result = useAtomValue(readHistoryWindow(selection));
  const more = useAtomSet(query);
  return {
    result,
    value: Option.getOrUndefined(AsyncResult.value(result)),
    readMore: () => more(undefined),
    retry: useAtomRefresh(query),
  };
}

export function useCommit(
  selection: HistorySelection,
  oid: string,
  parent: number,
) {
  const query = readCommit({ ...selection, oid, parent });
  const result = useAtomValue(query);
  return {
    result,
    value: Option.getOrUndefined(AsyncResult.value(result)),
    retry: useAtomRefresh(query),
  };
}

export function useCommitPatch(
  selection: HistorySelection,
  oid: string,
  parent: number,
  paths: readonly string[],
) {
  const query = readCommitDiffs({ ...selection, oid, parent, paths: [paths] });
  const result = useAtomValue(query);
  const value = Option.getOrUndefined(AsyncResult.value(result));
  return {
    result,
    value: value?.diffs.find(
      (diff) => diff.paths.join('\0') === paths.join('\0'),
    )?.content,
    retry: useAtomRefresh(query),
  };
}
