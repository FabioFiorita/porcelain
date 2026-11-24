import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { readChangeDiffWindow } from '@porcelain/client/changes';
import type {
  ChangesScope,
  ChangeSelection,
  ExpectedFile,
  DiffContent,
} from '@porcelain/client/changes/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useChangeDiffs(
  scope: ChangesScope,
  connection: Connection,
  statusToken: string,
  expectedFiles: readonly ExpectedFile[],
  selections: readonly ChangeSelection[],
) {
  const window = readChangeDiffWindow({
    scope,
    connection,
    statusToken,
    expectedFiles,
    selections,
  });
  const { result, recovery } = useAtomValue(window);
  const recovering = Option.exists(
    AsyncResult.value(recovery),
    (state) => state.pending,
  );
  return {
    diffs: AsyncResult.isSuccess(result)
      ? result.value
      : new Map<string, DiffContent>(),
    pending: AsyncResult.isInitial(result) || recovering,
    failed: AsyncResult.isFailure(result) && !recovering,
    retry: useAtomRefresh(window),
  };
}
