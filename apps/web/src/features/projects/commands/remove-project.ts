import { useMutation, useQueryClient } from '@tanstack/react-query';
import { operationMutation } from '@/shared/query/mutation';
import { projectCommands } from '@porcelain/client/projects';
import type { Connection } from '@/shared/workspace/connection';

export function useRemoveProject(connection: Connection, close: () => void) {
  const commands = projectCommands(connection, useQueryClient());
  const mutation = useMutation({
    ...operationMutation(commands.remove, connection),
    onSuccess: close,
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
