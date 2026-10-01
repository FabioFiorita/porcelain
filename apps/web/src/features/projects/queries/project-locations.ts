import { queryOptions, useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api';
import { PROJECT_DISCOVERY_STALE_MS } from '@/config/limits';
import { type Connection } from '@/shared/workspace/connection';

function projectDiscoveryQueryOptions(
  environmentId: string,
  connection: Connection,
) {
  return queryOptions({
    queryKey: ['project-discovery', environmentId],
    queryFn: ({ signal }) =>
      projectsApi(connection).inventory.discover(
        connection.request(signal).signal,
      ),
    staleTime: PROJECT_DISCOVERY_STALE_MS,
    retry: false,
  });
}

function projectFolderQueryOptions(
  environmentId: string,
  path: string | undefined,
  connection: Connection,
) {
  return queryOptions({
    queryKey: ['project-folder', environmentId, path ?? null],
    queryFn: ({ signal }) =>
      projectsApi(connection).inventory.browse(
        connection.request(signal).signal,
        path,
      ),
    retry: false,
  });
}

export function useProjectDiscovery(
  connection: Connection | null,
  enabled: boolean,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQuery({
    ...projectDiscoveryQueryOptions(connection.environmentId, connection),
    enabled,
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
