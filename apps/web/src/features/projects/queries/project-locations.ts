import { queryKeys } from '@porcelain/client/transport';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api';
import { type Connection } from '@/shared/workspace/connection';

function projectFolderQueryOptions(
  environmentId: string,
  path: string | undefined,
  connection: Connection,
) {
  return queryOptions({
    queryKey: queryKeys.projectFolder(environmentId, path),
    queryFn: ({ signal }) =>
      projectsApi(connection).inventory.browse({
        signal: connection.request(signal).signal,
        path,
      }),
    retry: false,
  });
}

export function useProjectFolder(
  connection: Connection,
  path: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    ...projectFolderQueryOptions(connection.environmentId, path, connection),
    enabled,
  });
}
