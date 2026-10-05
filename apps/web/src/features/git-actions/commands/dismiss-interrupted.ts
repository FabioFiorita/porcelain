import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GitScope } from '@porcelain/client/git-actions/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { operationMutation } from '@/shared/query/mutation';
import { gitActionCommands } from '@porcelain/client/git-actions';

export function useDismissInterrupted(
  scope: GitScope,
  context: ConnectionContext,
) {
  const { connection } = context;
  const commands = gitActionCommands(scope, connection, useQueryClient());
  const mutation = useMutation(operationMutation(commands.dismiss, connection));
  return {
    isPending: mutation.isPending,
    error: mutation.error,
    dismiss: (requestId: string) => mutation.mutate(requestId),
  };
}
