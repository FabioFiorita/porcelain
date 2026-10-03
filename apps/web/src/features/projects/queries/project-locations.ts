import { queryOptions, useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api';
import { type Connection } from '@/shared/workspace/connection';

function projectFolderQueryOptions(
  environmentId: string,
  path: string | undefined,
  connection: Connection,
) {
  return queryOptions({
    queryKey: ['project-folder', environmentId, path ?? null],
    queryFn: ({ signal }) =>
      projectsApi(connection).inventory.browse({
        signal: connection.request(signal).signal,
        path,
      }),
    retry: false,
  });
}

export function useProjectFolder(
  connection: Connection | null,
  path: string | undefined,
  enabled: boolean,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQuery({
    ...projectFolderQueryOptions(connection.environmentId, path, connection),
    enabled,
  });
}
