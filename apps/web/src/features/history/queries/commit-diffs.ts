import { useQueries } from '@tanstack/react-query';
import type { ReadCommitDiffsResponse } from '@porcelain/contracts/changes';
import { DIFFS_PER_REQUEST } from '@porcelain/contracts/shared';
import { historyApi } from '../api';
import type { HistoryConnection, HistoryScope } from '../rules/connection';

type DiffContent = ReadCommitDiffsResponse['diffs'][number]['content'];

export function useCommitDiffs(
  connection: HistoryConnection | null,
  scope: HistoryScope,
  oid: string,
  parent: number,
  paths: readonly (readonly string[])[],
) {
  if (!connection) throw new Error('A connected environment is required');
  const batches: (readonly string[])[][] = [];
  for (let at = 0; at < paths.length; at += DIFFS_PER_REQUEST)
    batches.push([...paths.slice(at, at + DIFFS_PER_REQUEST)]);
  const results = useQueries({
    queries: batches.map((batch) => ({
      queryKey: [
        'review',
        connection.environmentId,
        scope.projectId,
        scope.worktreeId,
        'commit-diffs',
        oid,
        parent,
        batch.map((entry) => entry.join('\0')),
      ],
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const connected = connection.request(signal);
        const data = await historyApi.diffs(
          connected.signal,
          scope.worktreeId,
          oid,
          parent,
          batch.map((entry) => [...entry]),
        );
        connected.signal.throwIfAborted();
        return data.diffs;
      },
    })),
  });
  const patches = new Map<string, DiffContent>();
  for (const result of results)
    for (const diff of result.data ?? [])
      patches.set(diff.paths.join('\0'), diff.content);
  return {
    patches,
    isPending: results.some((result) => result.isPending),
    isError: results.some((result) => result.isError),
    retry: () => {
      for (const result of results) if (result.isError) void result.refetch();
    },
  };
}
