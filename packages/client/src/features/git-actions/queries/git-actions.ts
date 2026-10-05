import { runRequest } from '../../../shared/api/effect-client.ts';
import type { QueryFunctionContext } from '@tanstack/query-core';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { gitActionsApi } from '../api.ts';

export function commitModelsQueryOptions(connection: WorktreeConnection) {
  return {
    queryKey: queryKeys.commitModels(connection.environmentId),
    queryFn: ({ signal }: Pick<QueryFunctionContext, 'signal'>) =>
      runRequest(
        gitActionsApi(connection).listCommitModels({}),
        connection.request(signal).signal,
      ),
  };
}
