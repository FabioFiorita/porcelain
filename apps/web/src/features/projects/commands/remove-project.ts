import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProjectConnection } from '../rules/connection';
import { ConnectionError } from '@/shared/api/connection-error';
import { retainedFileDrafts } from '@/shared/query/file-drafts';
import { queryKeys } from '@/shared/query/keys';
import { projectsApi } from '../api';
import { inventoryQueryOptions } from '../queries/inventory';
import type { Inventory } from '../rules/inventory';

export function useRemoveProject(
  connection: ProjectConnection | null,
  close: () => void,
) {
  if (!connection) throw new Error('A connected environment is required');
  const client = useQueryClient();
  const key = inventoryQueryOptions(
    connection.environmentId,
    connection.request,
  ).queryKey;
  const mutation = useMutation({
    scope: { id: `inventory:${connection.environmentId}` },
    mutationFn: async (projectId: string) => {
      const prefix = `[${JSON.stringify(projectId)},`;
      for (const [draftKey, draft] of retainedFileDrafts(connection))
        if (draftKey.startsWith(prefix) && !(await draft.save()))
          throw new ConnectionError(
            'Save or discard unsaved file drafts before removing this project.',
          );
      await client.cancelQueries({ queryKey: key });
      const request = connection.request();
      const result = await projectsApi.inventory.remove(
        request.signal,
        projectId,
      );
      request.signal.throwIfAborted();
      return result;
    },
    onSuccess: async (_result, projectId) => {
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<Inventory>(
        key,
        (inventory) =>
          inventory && {
            ...inventory,
            projects: inventory.projects.filter(
              (project) => project.id !== projectId,
            ),
          },
      );
      const projectKey = queryKeys.reviewProject(
        connection.environmentId,
        projectId,
      );
      await client.cancelQueries({ queryKey: projectKey });
      client.removeQueries({ queryKey: projectKey });
      close();
    },
  });
  return {
    confirm: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
    onCloseChange: (open: boolean) => {
      if (!open && !mutation.isPending) mutation.reset();
    },
  };
}
