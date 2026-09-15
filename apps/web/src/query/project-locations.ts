import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './keys';
import { useConnectedContext } from './workspace-provider';

export function useProjectDiscovery(enabled: boolean) {
  const { api, connection } = useConnectedContext();
  return useQuery({
    queryKey: queryKeys.projectDiscovery(connection.environmentId),
    queryFn: ({ signal }) => api.inventory.discover(connection.request(signal)),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useProjectFolder(path: string | undefined, enabled: boolean) {
  const { api, connection } = useConnectedContext();
  return useQuery({
    queryKey: queryKeys.projectFolder(connection.environmentId, path),
    queryFn: ({ signal }) =>
      api.inventory.browse({
        ...connection.request(signal),
        ...(path === undefined ? {} : { path }),
      }),
    enabled,
    retry: false,
  });
}
