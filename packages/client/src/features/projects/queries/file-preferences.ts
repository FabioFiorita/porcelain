import type { QueryFunctionContext } from '@tanstack/query-core';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { projectsApi } from '../api.ts';

export function filePreferencesQueryOptions(
  connection: WorktreeConnection,
  projectId: string,
) {
  return {
    queryKey: queryKeys.withIdentity(
      queryKeys.filePreferences(connection.environmentId, projectId),
      connection,
    ),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await projectsApi(connection).filePreferences.list({
        ...connected,
        projectId,
      });
      assertCurrentAnswer(connected.signal);
      return result;
    },
  };
}
