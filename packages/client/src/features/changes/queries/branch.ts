import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type { ReadBranchDiffsRequest } from '@porcelain/contracts/changes';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { changesApi } from '../api.ts';
import { pathDiffReadsQueryOptions } from './batched-reads.ts';
import type { BranchRange } from '../rules/branch.ts';

export function branchBasesQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
) {
  return {
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'branch-bases',
    ]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const request = connection.request(signal);
      const bases = await changesApi(connection).branchBases({
        signal: request.signal,
        worktreeId: scope.worktreeId,
      });
      assertCurrentAnswer(request.signal);
      return bases;
    },
  };
}

export function branchQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  base?: string,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'branch',
      base ?? null,
    ]),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).branch({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        base,
      });
      assertCurrentAnswer(
        connected.signal,
        result.worktreeId === scope.worktreeId,
      );
      return result;
    },
  };
}

export function branchDiffReadsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  range: BranchRange | null,
  paths: readonly (readonly string[])[],
  size: number,
) {
  return pathDiffReadsQueryOptions({
    connection,
    paths: range ? paths : [],
    size,
    key: (batch) =>
      range
        ? branchDiffsQueryOptions(scope, connection, {
            baseOid: range.baseOid,
            headOid: range.headOid,
            paths: batch.map((entry) => [...entry]),
          }).queryKey
        : [],
    read: async (signal, batch) =>
      range
        ? branchDiffsQueryOptions(scope, connection, {
            baseOid: range.baseOid,
            headOid: range.headOid,
            paths: batch,
          }).queryFn({ signal })
        : { diffs: [] },
  });
}

export function branchDiffsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  input: ReadBranchDiffsRequest,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'branch-diffs',
      input,
    ]),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).branchDiffs({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        input,
      });
      assertCurrentAnswer(connected.signal);

      return result;
    },
  };
}
