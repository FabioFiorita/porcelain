import type { ReadCommitDiffsResponse } from '@porcelain/contracts/changes';
import { DIFF_WINDOW_FILES } from '@/config/limits';
import { useBatchedReads } from './batched-reads';
import { consecutiveBatches } from '../rules/diff-batches';
import { changesApi } from '../api';
import type { ChangesConnection, ChangesScope } from '../rules/changes';

type DiffContent = ReadCommitDiffsResponse['diffs'][number]['content'];

export function useCommitDiffs(
  connection: ChangesConnection | null,
  scope: ChangesScope,
  oid: string,
  parent: number,
  paths: readonly (readonly string[])[],
) {
  if (!connection) throw new Error('A connected environment is required');
  const read = useBatchedReads({
    batches: consecutiveBatches(paths, DIFF_WINDOW_FILES),
    key: (batch) => [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'commit-diffs',
      oid,
      parent,
      batch.map((entry) => entry.join('\0')),
    ],
    read: async (batch, signal) => {
      const connected = connection.request(signal);
      const data = await changesApi.commitDiffs(
        connected.signal,
        scope.worktreeId,
        oid,
        parent,
        batch.map((entry) => [...entry]),
      );
      connected.signal.throwIfAborted();
      return data.diffs.map(
        (diff) => [diff.paths.join('\0'), diff.content] as const,
      );
    },
  });
  return {
    patches: new Map<string, DiffContent>(read.entries),
    isPending: read.pending,
    isError: read.failed,
    retry: read.retry,
  };
}
