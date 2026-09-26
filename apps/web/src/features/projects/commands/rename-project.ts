import { renameProjectRequestSchema } from '@porcelain/contracts/projects';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProjectConnection } from '../rules/connection';
import { asMutation } from '@/shared/query/mutation';
import { projectsApi } from '../api';
import { inventoryQueryOptions } from '../queries/inventory';
import type { Inventory } from '../rules/inventory';

export function useRenameProject(
  connection: ProjectConnection | null,
  close: () => void,
) {
  if (!connection) throw new Error('A connected environment is required');
  const client = useQueryClient();
  const key = inventoryQueryOptions(
    connection.environmentId,
    connection.request,
  ).queryKey;
  const mutation = asMutation(
    useMutation({
      scope: { id: `inventory:${connection.environmentId}` },
      mutationFn: async ({
        projectId,
        name,
      }: {
        projectId: string;
        name: string;
      }) => {
        const request = connection.request();
        const result = await projectsApi.inventory.rename(
          request.signal,
          projectId,
          name,
        );
        request.signal.throwIfAborted();
        return result;
      },
      onSuccess: async (result) => {
        await client.cancelQueries({ queryKey: key });
        client.setQueryData<Inventory>(
          key,
          (inventory) =>
            inventory && {
              ...inventory,
              projects: inventory.projects.map((project) =>
                project.id === result.id
                  ? { ...project, name: result.name }
                  : project,
              ),
            },
        );
        close();
      },
    }),
  );
  return {
    submit: mutation.submit,
    isPending: mutation.isPending,
    error: mutation.error,
    onCloseChange: (open: boolean) => {
      if (!open && !mutation.isPending) mutation.reset();
    },
  };
}

export const renameProjectValidator = renameProjectRequestSchema;
