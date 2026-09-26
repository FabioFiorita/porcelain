import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { changesApi, isWorktreeChangedError } from '../api';
import {
  requireChangesConnection,
  selectionKey,
  type ChangesConnection,
  type ChangesScope,
  type ChangeSelection,
  type DiffContent,
  type ExpectedFile,
} from '../rules/changes';
import { useChangesStore } from '../store';

export function useChangeDiffs(
  scope: ChangesScope,
  possibleConnection: ChangesConnection | null,
  statusToken: string,
  expectedFiles: readonly ExpectedFile[],
  selections: readonly ChangeSelection[],
  recover: (statusToken: string) => void,
) {
  const connection = requireChangesConnection(possibleConnection);
  const key = JSON.stringify([
    connection.environmentId,
    scope.projectId,
    scope.worktreeId,
  ]);
  const recovering = useChangesStore(
    (state) => state.pending[key] === statusToken,
  );
  const wanted = [...selections].sort((left, right) =>
    selectionKey(left).localeCompare(selectionKey(right)),
  );
  const query = useQuery({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'change-diffs',
      statusToken,
      [...expectedFiles]
        .map((file) => `${file.path}:${file.fingerprint ?? ''}`)
        .sort(),
      wanted.map(selectionKey),
    ]),
    enabled: wanted.length > 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const data = await changesApi.diffs(request.signal, scope.worktreeId, {
        expectedStatusToken: statusToken,
        expectedFiles: [...expectedFiles].sort((left, right) =>
          left.path.localeCompare(right.path),
        ),
        selections: wanted,
      });
      request.signal.throwIfAborted();
      return new Map(
        data.diffs.map(({ selection, content }) => [
          selectionKey(selection),
          content,
        ]),
      );
    },
    retry: (_failureCount, error) => {
      if (isWorktreeChangedError(error)) recover(statusToken);
      return false;
    },
    throwOnError: false,
  });
  return {
    diffs: query.data ?? new Map<string, DiffContent>(),
    pending: (wanted.length > 0 && query.isPending) || recovering,
    failed: query.isError && !recovering,
    retry: () => void query.refetch(),
  };
}
