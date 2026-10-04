import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import type {
  ReadChangeDiffsRequest,
  ReadChangesResponse,
} from '@porcelain/contracts/changes';
import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type WorktreeConnection,
  type WorktreeScope,
} from '../../../shared/api/connection.ts';
import { changesApi } from '../api.ts';
import { DIFFS_PER_REQUEST } from '@porcelain/contracts/shared';
import { readChangeDiffsEndpoint } from '@porcelain/contracts/changes';
import { isEndpointError } from '../../../shared/api/request.ts';
import { diffBatches } from '../rules/diff-batches.ts';
import {
  selectionKey,
  changeSelections,
  expectedDiffFiles,
  type ExpectedFile,
  type ChangeSelection,
} from '../rules/changes.ts';
import { batchedReadsQueryOptions } from './batched-reads.ts';

export function changeDiffsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  input: ReadChangeDiffsRequest,
) {
  return {
    queryKey: queryKeys.worktreeSurface(connection, scope, [
      'change-diffs',
      input,
    ]),
    retry: false,
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await changesApi(connection).diffs({
        signal: connected.signal,
        worktreeId: scope.worktreeId,
        input,
      });
      assertCurrentAnswer(
        connected.signal,
        result.environmentId === connection.environmentId &&
          result.worktreeId === scope.worktreeId &&
          result.statusToken === input.expectedStatusToken,
      );
      return result;
    },
  };
}

export function fileDiffReadsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  list: ReadChangesResponse,
  path: string,
  recover: (statusToken: string) => void,
) {
  const files = list.changes.filter((file) => file.path === path);
  return changeDiffReadsQueryOptions(
    scope,
    connection,
    list.statusToken,
    expectedDiffFiles(files),
    files.flatMap((file) => file.comparisons.flatMap(changeSelections)),
    recover,
  );
}

export function changeDiffReadsQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  statusToken: string,
  expectedFiles: readonly ExpectedFile[],
  selections: readonly ChangeSelection[],
  recover: (statusToken: string) => void,
) {
  return batchedReadsQueryOptions({
    batches: diffBatches(expectedFiles, selections, DIFFS_PER_REQUEST),
    key: (batch) =>
      changeDiffsQueryOptions(scope, connection, {
        expectedStatusToken: statusToken,
        expectedFiles: batch.expectedFiles,
        selections: batch.selections,
      }).queryKey,
    read: async (batch, signal) => {
      const data = await changeDiffsQueryOptions(scope, connection, {
        expectedStatusToken: statusToken,
        expectedFiles: batch.expectedFiles,
        selections: batch.selections,
      }).queryFn({ signal });
      return data.diffs.map(
        ({ selection, content }) => [selectionKey(selection), content] as const,
      );
    },
    retry: (_failureCount, error) => {
      if (isEndpointError(error, readChangeDiffsEndpoint, 'worktree_changed'))
        recover(statusToken);
      return false;
    },
  });
}
