import type { QueryFunctionContext } from '@tanstack/query-core';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { runRequest } from '../../../shared/api/effect-client.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { projectsApi } from '../api.ts';

export function projectFolderQueryOptions(
  connection: WorktreeConnection,
  path: string | undefined,
) {
  return {
    queryKey: queryKeys.withIdentity(
      queryKeys.projectFolder(connection.environmentId, path),
      connection,
    ),
    queryFn: async ({ signal }: Pick<QueryFunctionContext, 'signal'>) => {
      const connected = connection.request(signal);
      const result = await runRequest(
        projectsApi(connection).browseProjectFolders({
          query: path === undefined ? {} : { path },
        }),
        connected.signal,
      );
      assertCurrentAnswer(connected.signal);
      return result;
    },
    retry: false as const,
  };
}
