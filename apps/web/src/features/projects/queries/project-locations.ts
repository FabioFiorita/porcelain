import { queryOptions, useQuery } from '@tanstack/react-query';
import type { ProjectConnection } from '../rules/connection';
import { projectsApi } from '../api';
import { PROJECT_DISCOVERY_STALE_MS } from '@/config/limits';

function projectDiscoveryQueryOptions(
  environmentId: string,
  request: (signal?: AbortSignal) => { signal: AbortSignal },
) {
  return queryOptions({
    queryKey: ['project-discovery', environmentId],
    queryFn: ({ signal }) =>
      projectsApi.inventory.discover(request(signal).signal),
    staleTime: PROJECT_DISCOVERY_STALE_MS,
    retry: false,
  });
}

function projectFolderQueryOptions(
  environmentId: string,
  path: string | undefined,
  request: (signal?: AbortSignal) => { signal: AbortSignal },
) {
  return queryOptions({
    queryKey: ['project-folder', environmentId, path ?? null],
    queryFn: ({ signal }) =>
      projectsApi.inventory.browse(request(signal).signal, path),
    retry: false,
  });
}

export function useProjectDiscovery(
  connection: ProjectConnection | null,
  enabled: boolean,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQuery({
    ...projectDiscoveryQueryOptions(
      connection.environmentId,
      connection.request,
    ),
    enabled,
  });
}

export function useProjectFolder(
  connection: ProjectConnection | null,
  path: string | undefined,
  enabled: boolean,
) {
  if (!connection) throw new Error('A connected environment is required');
  return useQuery({
    ...projectFolderQueryOptions(
      connection.environmentId,
      path,
      connection.request,
    ),
    enabled,
  });
}
