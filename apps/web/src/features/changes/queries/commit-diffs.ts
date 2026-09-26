import { DIFFS_PER_REQUEST } from '@porcelain/contracts/shared';
import { useQueries } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import type {
  ChangesConnection,
  ChangesScope,
  DiffContent,
} from '../rules/changes';
import { requireChangesConnection } from '../rules/changes';

export function useCommitDiffs(
  scope: ChangesScope,
  possibleConnection: ChangesConnection | null,
  oid: string,
  parent: number,
  paths: readonly (readonly string[])[],
) {
  const connection = requireChangesConnection(possibleConnection);
  const batches: (readonly string[])[][] = [];
  for (let at = 0; at < paths.length; at += DIFFS_PER_REQUEST)
    batches.push([...paths.slice(at, at + DIFFS_PER_REQUEST)]);
  const results = useQueries({
    queries: batches.map((batch) => ({
      queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
        'commit-diffs',
        oid,
        parent,
        batch.map((entry) => entry.join('\0')),
      ]),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const request = connection.request(signal);
        const data = await changesApi.commitDiffs(
          request.signal,
          scope.worktreeId,
          oid,
          { parent, paths: batch.map((entry) => [...entry]) },
        );
        request.signal.throwIfAborted();
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
