import type { GitContext } from '../api';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { COMMIT_MODELS_STALE_MS } from '@/config/limits';
import { queryKeys } from '@/shared/query/keys';
import type { GitScope } from '../rules/git-action';

function commitModelsQueryOptions(context: GitContext) {
  return queryOptions({
    queryKey: queryKeys.commitModels(context.connection.environmentId),
    queryFn: ({ signal }) =>
      context.api.gitActions.models({
        ...context.connection.request(),
        signal: AbortSignal.any([signal, context.connection.controller.signal]),
      }),
    staleTime: COMMIT_MODELS_STALE_MS,
  });
}
export function useCommitModels(context: GitContext) {
  return useQuery(commitModelsQueryOptions(context));
}
function branchesQueryOptions(scope: GitScope, context: GitContext) {
  return queryOptions({
    queryKey: queryKeys.reviewSurface(context.connection.environmentId, scope, [
      'branches',
    ]),
    queryFn: ({ signal }) =>
      context.api.gitActions.branches({
        ...scope,
        ...context.connection.request(signal),
      }),
    staleTime: 0,
  });
}
export function useBranches(scope: GitScope, context: GitContext) {
  return useQuery(branchesQueryOptions(scope, context));
}
