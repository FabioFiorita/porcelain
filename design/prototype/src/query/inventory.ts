import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Inventory } from '../domain/inventory';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

/**
 * Projects and their worktrees, listed live from Git by the server. Nothing here
 * refreshes: the live channel says when a worktree appears, moves or goes away.
 */
export function useInventory(): Inventory {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQuery({
    queryKey: queryKeys.inventory(environmentId),
    queryFn: ({ signal }) => api.inventory.read({ signal }),
  }).data;
}

export function useRegisterProject() {
  const { api, environmentId } = useWorkspaceContext();
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (path: string) => api.inventory.register({ path }),
      onSuccess: async () => {
        await client.invalidateQueries({
          queryKey: queryKeys.inventory(environmentId),
        });
        await client.invalidateQueries({
          queryKey: queryKeys.discovered(environmentId),
        });
        await client.invalidateQueries({ queryKey: ['browse', environmentId] });
      },
    }),
  );
}

export function useDiscoveredRepositories(enabled: boolean) {
  const { api, environmentId } = useWorkspaceContext();
  const query = useQuery({
    queryKey: queryKeys.discovered(environmentId),
    queryFn: () => api.inventory.discover(),
    enabled,
    staleTime: 0,
  });
  return { repositories: query.data ?? [], isPending: query.isPending };
}

/** The folder browser. Keeps showing the previous folder while the next one loads. */
export function useBrowseDirectories(path: string | null, enabled: boolean) {
  const { api, environmentId } = useWorkspaceContext();
  const query = useQuery({
    queryKey: queryKeys.browse(environmentId, path),
    queryFn: ({ signal }) => api.inventory.browse({ path, signal }),
    enabled,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
  return {
    listing: query.data,
    error: query.error,
    isFetching: query.isFetching,
  };
}

export function useRemoveProject() {
  const { api, environmentId } = useWorkspaceContext();
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (projectId: string) => api.inventory.remove({ projectId }),
      onSuccess: async () => {
        await client.invalidateQueries({
          queryKey: queryKeys.inventory(environmentId),
        });
        await client.invalidateQueries({
          queryKey: queryKeys.discovered(environmentId),
        });
        await client.invalidateQueries({ queryKey: ['browse', environmentId] });
      },
    }),
  );
}

/** Renames a project for this server; the name came from the `origin` URL or the folder. */
export function useRenameProject() {
  const { api, environmentId } = useWorkspaceContext();
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (input: { projectId: string; name: string }) =>
        api.inventory.rename(input),
      onSuccess: () =>
        client.invalidateQueries({
          queryKey: queryKeys.inventory(environmentId),
        }),
    }),
  );
}
