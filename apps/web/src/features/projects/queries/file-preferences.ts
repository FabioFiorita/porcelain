import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import type { ProjectConnection } from '../rules/connection';
import { projectsApi } from '../api';

export function filePreferencesQueryOptions(
  environmentId: string,
  projectId: string,
  request: (signal?: AbortSignal) => { signal: AbortSignal },
) {
  return queryOptions({
    queryKey: ['review', environmentId, projectId, 'file-preferences'],
    queryFn: async ({ signal }) => {
      const connected = request(signal);
      const response = await projectsApi.filePreferences.list(
        connected.signal,
        projectId,
      );
      connected.signal.throwIfAborted();
      return response;
    },
  });
}

export function useHiddenPaths(
  connection: ProjectConnection | null,
  projectId: string,
): ReadonlySet<string> {
  if (!connection) throw new Error('A connected environment is required');
  const response = useSuspenseQuery(
    filePreferencesQueryOptions(
      connection.environmentId,
      projectId,
      connection.request,
    ),
  ).data;
  return new Set(
    response.preferences
      .filter((preference) => preference.hidden)
      .map((preference) => preference.path),
  );
}
