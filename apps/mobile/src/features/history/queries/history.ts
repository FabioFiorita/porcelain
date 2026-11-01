import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import {
  readCommit,
  readHistory,
  readHistoryWindow,
  readFileTimeline,
  readFileTimelineWindow,
} from '@porcelain/client/history';
import { readCommitDiffs, readGitStatus } from '@porcelain/client/changes';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { Option } from 'effect';
import { AsyncResult, type Atom } from 'effect/reactivity';

export type HistorySelection = {
  connection: RuntimeConnection;
  scope: HistoryScope;
};

export function useHistoryStatus(selection: HistorySelection) {
  const query = readGitStatus(selection);
  return { result: useAtomValue(query), retry: useAtomRefresh(query) };
}

export function useHistory(selection: HistorySelection) {
  return usePagedHistory(readHistory(selection), readHistoryWindow(selection));
}

export function useFileTimeline(selection: HistorySelection, path: string) {
  const input = { ...selection, path };
  return usePagedHistory(
    readFileTimeline(input),
    readFileTimelineWindow(input),
  );
}

function usePagedHistory<Page, Window, E>(
  query: Atom.Writable<Atom.PullResult<Page, E>, void>,
  window: Atom.Atom<AsyncResult.AsyncResult<Window, E>>,
) {
  const result = useAtomValue(window);
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
