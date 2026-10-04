import type { QueryFunctionContext } from '@tanstack/query-core';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { gitActionsApi } from '../api.ts';

export function commitModelsQueryOptions(connection: WorktreeConnection) {
  return {
    queryKey: queryKeys.commitModels(connection.environmentId),
    queryFn: ({ signal }: Pick<QueryFunctionContext, 'signal'>) =>
      gitActionsApi(connection).models(connection.request(signal)),
  };
}
