import { useMutation } from '@tanstack/react-query';
import { ConnectionError } from '@/shared/api/connection-error';
import { retainedFileDrafts } from '@/shared/query/file-drafts';
import { queryKeys } from '@/shared/query/keys';
import { projectsApi } from '../api';
import { useInventoryCache } from './inventory-cache';
import { type Connection } from '@/shared/workspace/connection';

export function useRemoveProject(
  possibleConnection: Connection | null,
  close: () => void,
) {
  const { connection, client, key, scope, update } =
    useInventoryCache(possibleConnection);
  const mutation = useMutation({
    scope,
    mutationFn: async (projectId: string) => {
      const prefix = `[${JSON.stringify(projectId)},`;
      for (const [draftKey, draft] of retainedFileDrafts(connection))
        if (draftKey.startsWith(prefix) && !(await draft.save()))
          throw new ConnectionError(
            'Save or discard unsaved file drafts before removing this project.',
          );
      await client.cancelQueries({ queryKey: key });
      const request = connection.request();
      const result = await projectsApi(connection).inventory.remove(
        request.signal,
        projectId,
      );
      request.signal.throwIfAborted();
      return result;
    },
    onSuccess: async (_result, projectId) => {
      await update((inventory) => ({
        ...inventory,
        projects: inventory.projects.filter(
          (project) => project.id !== projectId,
        ),
      }));
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
