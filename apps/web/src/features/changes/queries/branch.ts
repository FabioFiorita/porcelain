import { queryOptions, useQueries, useQuery } from '@tanstack/react-query';
import { DIFFS_PER_REQUEST } from '@porcelain/contracts/shared';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import type { BranchRange } from '../rules/branch';
import {
  requireChangesConnection,
  type ChangesConnection,
  type ChangesScope,
  type DiffContent,
} from '../rules/changes';

function branchChangesQueryOptions(
  scope: ChangesScope,
  connection: ChangesConnection,
  base: string | undefined,
) {
  return queryOptions({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'branch',
      base ?? null,
    ]),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const changes = await changesApi.branch(
        request.signal,
        scope.worktreeId,
        base,
      );
      request.signal.throwIfAborted();
      return changes;
    },
  });
}

export function useBranchChanges(
  scope: ChangesScope,
  connection: ChangesConnection | null,
  base: string | undefined,
) {
  return useQuery(
    branchChangesQueryOptions(
      scope,
      requireChangesConnection(connection),
      base,
    ),
  );
}

export function useBranchBases(
  scope: ChangesScope,
  connection: ChangesConnection | null,
  enabled: boolean,
) {
  const connected = requireChangesConnection(connection);
  return useQuery({
    queryKey: queryKeys.reviewSurface(connected.environmentId, scope, [
      'branch-bases',
    ]),
    enabled,
    queryFn: async ({ signal }) => {
      const request = connected.request(signal);
      const bases = await changesApi.branchBases(
        request.signal,
        scope.worktreeId,
      );
      request.signal.throwIfAborted();
      return bases;
    },
  });
}

export function useBranchDiffs(
  scope: ChangesScope,
  connection: ChangesConnection | null,
  range: BranchRange | null,
  paths: readonly (readonly string[])[],
) {
  const connected = requireChangesConnection(connection);
  const batches: (readonly string[])[][] = [];
  if (range)
    for (let at = 0; at < paths.length; at += DIFFS_PER_REQUEST)
      batches.push([...paths.slice(at, at + DIFFS_PER_REQUEST)]);
  const results = useQueries({
    queries: batches.map((batch) => ({
      queryKey: queryKeys.reviewSurface(connected.environmentId, scope, [
        'branch-diffs',
        range?.baseOid,
        range?.headOid,
        batch.map((entry) => entry.join('\0')),
      ]),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        if (!range) return [];
        const request = connected.request(signal);
        const data = await changesApi.branchDiffs(
          request.signal,
          scope.worktreeId,
          {
            baseOid: range.baseOid,
            headOid: range.headOid,
            paths: batch.map((entry) => [...entry]),
          },
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
