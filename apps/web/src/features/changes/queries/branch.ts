import {
  branchQueryOptions,
  branchBasesQueryOptions,
  branchDiffsQueryOptions,
} from '@porcelain/client/changes';
import { useQuery } from '@tanstack/react-query';
import { usePathDiffs } from './path-diffs';
import type { BranchRange } from '@porcelain/client/changes/rules';
import { type ChangesScope } from '@porcelain/client/changes/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useBranchChanges(
  scope: ChangesScope,
  connection: Connection,
  base: string | undefined,
) {
  return useQuery(branchQueryOptions(scope, connection, base));
}

export function useBranchBases(
  scope: ChangesScope,
  connection: Connection,
  enabled: boolean,
) {
  return useQuery({ ...branchBasesQueryOptions(scope, connection), enabled });
}

export function useBranchDiffs(
  scope: ChangesScope,
  connection: Connection,
  range: BranchRange | null,
  paths: readonly (readonly string[])[],
) {
  const connected = connection;
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
