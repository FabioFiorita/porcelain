import { queryOptions, useQuery } from '@tanstack/react-query';
import { usePathDiffs } from './path-diffs';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import type { BranchRange } from '../rules/branch';
import { type ChangesScope } from '../rules/changes';
import {
  type Connection,
  requireConnection,
} from '@/shared/workspace/connection';

function branchChangesQueryOptions(
  scope: ChangesScope,
  connection: Connection,
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
      const changes = await changesApi(connection).branch(
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
  connection: Connection | null,
  base: string | undefined,
) {
  return useQuery(
    branchChangesQueryOptions(scope, requireConnection(connection), base),
  );
}

export function useBranchBases(
  scope: ChangesScope,
  connection: Connection | null,
  enabled: boolean,
) {
  const connected = requireConnection(connection);
  return useQuery({
    queryKey: queryKeys.reviewSurface(connected.environmentId, scope, [
      'branch-bases',
    ]),
    enabled,
    queryFn: async ({ signal }) => {
      const request = connected.request(signal);
      const bases = await changesApi(connected).branchBases(
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
  connection: Connection | null,
  range: BranchRange | null,
  paths: readonly (readonly string[])[],
) {
  const connected = requireConnection(connection);
  return usePathDiffs({
    connection: connected,
    paths: range ? paths : [],
    key: (batch) =>
      queryKeys.reviewSurface(connected.environmentId, scope, [
        'branch-diffs',
        range?.baseOid,
        range?.headOid,
        batch.map((entry) => entry.join('\0')),
      ]),
    read: async (signal, batch) =>
      range
        ? changesApi(connected).branchDiffs(signal, scope.worktreeId, {
            baseOid: range.baseOid,
            headOid: range.headOid,
            paths: batch,
          })
        : { diffs: [] },
  });
}
