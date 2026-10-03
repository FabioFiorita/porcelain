import {
  branchQueryOptions,
  branchDiffsQueryOptions,
} from '@porcelain/client/changes';
import { useQuery } from '@tanstack/react-query';
import { usePathDiffs } from './path-diffs';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import type { BranchRange } from '../rules/branch';
import { type ChangesScope } from '../rules/changes';
import {
  type Connection,
  requireConnection,
} from '@/shared/workspace/connection';

export function useBranchChanges(
  scope: ChangesScope,
  connection: Connection | null,
  base: string | undefined,
) {
  return useQuery(
    branchQueryOptions(scope, requireConnection(connection), base),
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
      const bases = await changesApi(connected).branchBases({
        signal: request.signal,
        worktreeId: scope.worktreeId,
      });
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
      range
        ? branchDiffsQueryOptions(scope, connected, {
            baseOid: range.baseOid,
            headOid: range.headOid,
            paths: batch.map((entry) => [...entry]),
          }).queryKey
        : [],
    read: async (signal, batch) =>
      range
        ? branchDiffsQueryOptions(scope, connected, {
            baseOid: range.baseOid,
            headOid: range.headOid,
            paths: batch,
          }).queryFn({ signal })
        : { diffs: [] },
  });
}
