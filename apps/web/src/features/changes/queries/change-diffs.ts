import { changeDiffsQueryOptions } from '@porcelain/client/changes';
import { DIFFS_PER_REQUEST } from '@porcelain/contracts/shared';
import { useBatchedReads } from './batched-reads';
import { isStaleChangeObservation } from '@porcelain/client/transport';
import {
  selectionKey,
  type ChangesScope,
  type ChangeSelection,
  type DiffContent,
  type ExpectedFile,
} from '@porcelain/client/changes/rules';
import { diffBatches } from '@porcelain/client/changes/rules';
import { changedDiffRecovery } from '../store';
import { useAtomRef } from '@effect/atom-react';
import { type Connection } from '@/shared/workspace/connection';

export function useChangeDiffs(
  scope: ChangesScope,
  possibleConnection: Connection,
  statusToken: string,
  expectedFiles: readonly ExpectedFile[],
  selections: readonly ChangeSelection[],
  recover: (statusToken: string) => void,
) {
  const connection = possibleConnection;
  const key = JSON.stringify([
    connection.environmentId,
    scope.projectId,
    scope.worktreeId,
  ]);
  const recovering = useAtomRef(
    changedDiffRecovery.state.map(
      (state) => state.pending[key] === statusToken,
    ),
  );
  const batches = diffBatches(expectedFiles, selections, DIFFS_PER_REQUEST);
  const read = useBatchedReads({
    batches,
    key: (batch) =>
      changeDiffsQueryOptions(scope, connection, {
        expectedStatusToken: statusToken,
        expectedFiles: batch.expectedFiles,
        selections: batch.selections,
      }).queryKey,
    read: async (batch, signal) => {
      const data = await changeDiffsQueryOptions(scope, connection, {
        expectedStatusToken: statusToken,
        expectedFiles: batch.expectedFiles,
        selections: batch.selections,
      }).queryFn({ signal });
      return data.diffs.map(
        ({ selection, content }) => [selectionKey(selection), content] as const,
      );
    },
    retry: (_failureCount, error) => {
      if (isStaleChangeObservation(error)) recover(statusToken);
      return false;
    },
  });
  return {
    diffs: new Map<string, DiffContent>(read.complete ? read.entries : []),
    pending: read.pending || recovering,
    failed: read.failed && !recovering,
    retry: read.retry,
  };
}
