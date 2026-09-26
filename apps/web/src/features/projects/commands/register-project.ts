import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProjectConnection } from '../rules/connection';
import { asMutation } from '@/shared/query/mutation';
import { projectsApi } from '../api';
import { inventoryQueryOptions } from '../queries/inventory';
import type { Inventory } from '../rules/inventory';

export function useRegisterProject(connection: ProjectConnection | null) {
  if (!connection) throw new Error('A connected environment is required');
  const client = useQueryClient();
  const key = inventoryQueryOptions(
    connection.environmentId,
    connection.request,
  ).queryKey;
  return asMutation(
    useMutation({
      scope: { id: `inventory:${connection.environmentId}` },
      mutationFn: async (path: string) => {
        await client.cancelQueries({ queryKey: key });
        const request = connection.request();
        const project = await projectsApi.inventory.register(
          request.signal,
          path,
        );
        request.signal.throwIfAborted();
        return project;
      },
      onSuccess: async (project) => {
        await client.cancelQueries({ queryKey: key });
        client.setQueryData<Inventory>(key, (inventory) => {
          if (
            !inventory ||
            inventory.environmentId !== connection.environmentId
          )
            return inventory;
          const projects = inventory.projects.some(
            (entry) => entry.id === project.id,
          )
            ? inventory.projects.map((entry) =>
                entry.id === project.id ? project : entry,
              )
            : [...inventory.projects, project];
          return { ...inventory, projects };
        });
      },
    }),
  );
}
