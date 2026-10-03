import { renameProjectRequestSchema } from '@porcelain/contracts/projects';
import { useMutation } from '@tanstack/react-query';
import { asMutation } from '@/shared/query/mutation';
import { projectsApi } from '../api';
import { useInventoryCache } from './inventory-cache';
import { type Connection } from '@/shared/workspace/connection';

export function useRenameProject(
  possibleConnection: Connection | null,
  close: () => void,
) {
  const { connection, scope, update } = useInventoryCache(possibleConnection);
  const mutation = asMutation(
    useMutation({
      scope,
      mutationFn: async ({
        projectId,
        name,
      }: {
        projectId: string;
        name: string;
      }) => {
        const request = connection.request();
        const result = await projectsApi(connection).inventory.rename({
          signal: request.signal,
          projectId,
          name,
        });
        request.signal.throwIfAborted();
        return result;
      },
      onSuccess: async (result) => {
        await update((inventory) => ({
          ...inventory,
          projects: inventory.projects.map((project) =>
            project.id === result.id
              ? { ...project, name: result.name }
              : project,
          ),
        }));
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
