import { queryOptions, useQuery } from '@tanstack/react-query';
import { DIFF_WINDOW_FILES } from '@/config/limits';
import { useBatchedReads } from './batched-reads';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import type { BranchRange } from '../rules/branch';
import { consecutiveBatches } from '../rules/diff-batches';
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
  const read = useBatchedReads({
    batches: range ? consecutiveBatches(paths, DIFF_WINDOW_FILES) : [],
    key: (batch) =>
      queryKeys.reviewSurface(connected.environmentId, scope, [
        'branch-diffs',
        range?.baseOid,
        range?.headOid,
        batch.map((entry) => entry.join('\0')),
      ]),
    read: async (batch, signal) => {
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
