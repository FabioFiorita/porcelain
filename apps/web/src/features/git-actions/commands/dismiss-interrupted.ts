import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GitScope } from '../rules/git-action';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { gitActionCommands } from '@porcelain/client/git-actions';

export function useDismissInterrupted(
  scope: GitScope,
  context: ConnectionContext,
) {
  const { connection } = context;
  const commands = gitActionCommands(scope, connection, useQueryClient());
  const mutation = useMutation({
    mutationFn: commands.dismiss,
  });
  return {
    isPending: mutation.isPending,
    error: mutation.error,
    dismiss: (requestId: string) => mutation.mutate(requestId),
  };
}
