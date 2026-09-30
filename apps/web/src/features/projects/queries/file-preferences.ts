import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { projectsApi } from '../api';
import { type Connection } from '@/shared/workspace/connection';

export function filePreferencesQueryOptions(
  environmentId: string,
  projectId: string,
  connection: Connection,
) {
  return queryOptions({
    queryKey: ['review', environmentId, projectId, 'file-preferences'],
    queryFn: async ({ signal }) => {
      const connected = connection.request(signal);
      const response = await projectsApi(connection).filePreferences.list(
        connected.signal,
        projectId,
      );
      connected.signal.throwIfAborted();
      return response;
    },
  });
}

export function useHiddenPaths(
  connection: Connection | null,
  projectId: string,
): ReadonlySet<string> {
  if (!connection) throw new Error('A connected environment is required');
  const response = useSuspenseQuery(
    filePreferencesQueryOptions(
      connection.environmentId,
      projectId,
      connection,
    ),
  ).data;
  return new Set(
    response.preferences
      .filter((preference) => preference.hidden)
      .map((preference) => preference.path),
  );
}

export function usePinnedPaths(
  connection: Connection | null,
  projectId: string,
): readonly string[] {
  if (!connection) throw new Error('A connected environment is required');
  const response = useSuspenseQuery(
    filePreferencesQueryOptions(
      connection.environmentId,
      projectId,
      connection,
    ),
  ).data;
  return response.preferences
    .filter((preference) => preference.pinned)
    .map((preference) => preference.path);
}
