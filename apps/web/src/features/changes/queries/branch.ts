import {
  branchQueryOptions,
  branchBasesQueryOptions,
  branchDiffReadsQueryOptions,
} from '@porcelain/client/changes';
import { useQuery } from '@tanstack/react-query';
import { useBatchedReads } from './batched-reads';
import { DIFF_WINDOW_FILES } from '@/config/limits';
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
  const read = useBatchedReads(
    branchDiffReadsQueryOptions(
      scope,
      connection,
      range,
      paths,
      DIFF_WINDOW_FILES,
    ),
  );
  return {
    patches: new Map(read.entries),
    isPending: read.pending,
    isError: read.failed,
    retry: read.retry,
  };
}
