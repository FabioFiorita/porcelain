import { DIFFS_PER_REQUEST } from '@porcelain/contracts/shared';
import { useBatchedReads } from './batched-reads';
import { queryKeys } from '@/shared/query/keys';
import { changesApi, isWorktreeChangedError } from '../api';
import {
  selectionKey,
  type ChangesScope,
  type ChangeSelection,
  type DiffContent,
  type ExpectedFile,
} from '../rules/changes';
import { diffBatches } from '../rules/diff-batches';
import { useChangesStore } from '../store';
import {
  type Connection,
  requireConnection,
} from '@/shared/workspace/connection';

export function useChangeDiffs(
  scope: ChangesScope,
  possibleConnection: Connection | null,
  statusToken: string,
  expectedFiles: readonly ExpectedFile[],
  selections: readonly ChangeSelection[],
  recover: (statusToken: string) => void,
) {
  const connection = requireConnection(possibleConnection);
  const key = JSON.stringify([
    connection.environmentId,
    scope.projectId,
    scope.worktreeId,
  ]);
  const recovering = useChangesStore(
    (state) => state.pending[key] === statusToken,
  );
  const batches = diffBatches(expectedFiles, selections, DIFFS_PER_REQUEST);
  const read = useBatchedReads({
    batches,
    key: (batch) =>
      queryKeys.reviewSurface(connection.environmentId, scope, [
        'change-diffs',
        statusToken,
        batch.expectedFiles.map(
          (file) => `${file.path}:${file.fingerprint ?? ''}`,
        ),
        batch.selections.map(selectionKey),
      ]),
    read: async (batch, signal) => {
      const request = connection.request(signal);
      const data = await changesApi(connection).diffs(
        request.signal,
        scope.worktreeId,
        {
          expectedStatusToken: statusToken,
          expectedFiles: batch.expectedFiles,
          selections: batch.selections,
        },
      );
      request.signal.throwIfAborted();
      return data.diffs.map(
        ({ selection, content }) => [selectionKey(selection), content] as const,
      );
    },
    retry: (_failureCount, error) => {
      if (isWorktreeChangedError(error)) recover(statusToken);
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
