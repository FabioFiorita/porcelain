import { queryOptions, useQuery } from '@tanstack/react-query';
import { COMMIT_MODELS_STALE_MS } from '@/config/limits';
import { queryKeys } from '@/shared/query/keys';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { gitActionsApi } from '../api';

function commitModelsQueryOptions(context: ConnectionContext) {
  return queryOptions({
    queryKey: queryKeys.commitModels(context.connection.environmentId),
    queryFn: ({ signal }) =>
      gitActionsApi(context.connection).models({
        ...context.connection.request(),
        signal: AbortSignal.any([signal, context.connection.controller.signal]),
      }),
    staleTime: COMMIT_MODELS_STALE_MS,
  });
}
export function useCommitModels(context: ConnectionContext) {
  return useQuery(commitModelsQueryOptions(context));
}
