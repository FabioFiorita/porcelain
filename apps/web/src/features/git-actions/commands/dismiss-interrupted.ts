import type { GitContext } from '../api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asMutation } from '@/shared/query/mutation';
import { queryKeys } from '@/shared/query/keys';
import type { GitScope } from '../rules/git-action';

export function useDismissInterrupted(scope: GitScope, context: GitContext) {
  const { api, connection } = context;
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (requestId: string) =>
        api.gitActions.dismissInterrupted({
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
    }),
  );
}
