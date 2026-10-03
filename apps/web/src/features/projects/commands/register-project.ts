import { useMutation } from '@tanstack/react-query';
import { asMutation } from '@/shared/query/mutation';
import { projectsApi } from '../api';
import { useInventoryCache } from './inventory-cache';
import { type Connection } from '@/shared/workspace/connection';

export function useRegisterProject(possibleConnection: Connection | null) {
  const { connection, client, key, scope, update } =
    useInventoryCache(possibleConnection);
  return asMutation(
    useMutation({
      scope,
      mutationFn: async (path: string) => {
        await client.cancelQueries({ queryKey: key });
        const request = connection.request();
        const project = await projectsApi(connection).inventory.register({
          signal: request.signal,
          path,
        });
        request.signal.throwIfAborted();
        return project;
      },
      onSuccess: async (project) => {
        await update((inventory) => {
          if (inventory.environmentId !== connection.environmentId)
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
