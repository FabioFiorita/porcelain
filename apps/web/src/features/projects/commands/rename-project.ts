import { renameProjectRequestSchema } from '@porcelain/contracts/projects';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asMutation } from '@/shared/query/mutation';
import { projectCommands } from '@porcelain/client/projects';
import { type Connection } from '@/shared/workspace/connection';

export function useRenameProject(connection: Connection, close: () => void) {
  const commands = projectCommands(connection, useQueryClient());
  const mutation = asMutation(
    useMutation({
      mutationFn: commands.rename,
      onSuccess: () => {
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
