import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import type { GitScope } from '../rules/git-action';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { gitActionsApi } from '../api';

export function useDismissInterrupted(
  scope: GitScope,
  context: ConnectionContext,
) {
  const { connection } = context;
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (requestId: string) =>
      gitActionsApi(connection).dismissInterrupted({
        ...scope,
        ...connection.request(),
        requestId,
      }),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
          'changes',
        ]),
        exact: true,
      }),
  });
  return {
    isPending: mutation.isPending,
    error: mutation.error,
    dismiss: (requestId: string) => mutation.mutate(requestId),
  };
}
