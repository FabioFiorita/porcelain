import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConnectionError } from '@porcelain/client/transport';
import { retainedFileDrafts } from '@/shared/query/file-drafts';
import { projectCommands } from '@porcelain/client/projects';
import { type Connection } from '@/shared/workspace/connection';

export function useRemoveProject(connection: Connection, close: () => void) {
  const commands = projectCommands(connection, useQueryClient());
  const mutation = useMutation({
    mutationFn: async (projectId: string) => {
      const prefix = `[${JSON.stringify(projectId)},`;
      for (const [draftKey, draft] of retainedFileDrafts(connection))
        if (draftKey.startsWith(prefix) && !(await draft.save()))
          throw new ConnectionError(
            'Save or discard unsaved file drafts before removing this project.',
          );
      return commands.remove(projectId);
    },
    onSuccess: () => {
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
