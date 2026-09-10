import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActionInput,
  GitAction,
  Operation,
  Receipt,
} from '../domain/git-action';
import type { ReviewScope } from '../domain/review';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

export function useGitAction(scope: ReviewScope, action: GitAction) {
  const { api, connection } = useWorkspaceContext();
  const client = useQueryClient();
  if (!connection) throw new Error('A connected environment is required');
  const key = [
    'git-operation',
    connection.environmentId,
    scope.projectId,
    scope.worktreeId,
    action,
  ];
  const operation = useQuery<Operation | null>({
    queryKey: key,
    queryFn: () => null,
    enabled: false,
    // Uncertain request IDs must survive navigation for the whole connection.
    gcTime: Infinity,
    initialData: null,
  }).data;
  const session = connection;
  const request = () => ({
    ...scope,
    token: session.token,
    signal: AbortSignal.any([
      session.controller.signal,
      AbortSignal.timeout(15_000),
    ]),
  });
  async function accept(receipt: Receipt) {
    if (session.controller.signal.aborted) return;
    const expected = client.getQueryData<Operation>(key);
    if (
      !expected ||
      expected.requestId !== receipt.requestId ||
      expected.preparationId !== receipt.preparationId
    )
      throw new Error('Receipt identity mismatch');
    if (
      receipt.worktreeId !== scope.worktreeId ||
      receipt.projectId !== scope.projectId ||
      receipt.action !== action
    )
      throw new Error('Receipt context mismatch');
    client.setQueryData(key, {
      requestId: receipt.requestId,
      preparationId: receipt.preparationId,
      receipt,
    });
    if (receipt.refreshRequired)
      await client.invalidateQueries({
        queryKey: ['review', connection?.environmentId, scope.projectId],
      });
  }
  // Preparation reads and captures state; it has no Git/cache effects.
  // eslint-disable-next-line react-doctor/query-mutation-missing-invalidation
  const preparation = useMutation({
    mutationFn: (input: ActionInput) =>
      api.gitActions.prepare({ ...request(), action, input }),
  });
  const execution = useMutation({
    mutationFn: async (preparationId: string) => {
      if (client.getQueryData(key))
        throw new Error(
          'Check the existing receipt before starting another operation.',
        );
      const requestId = crypto.randomUUID();
      client.setQueryData(key, { requestId, preparationId });
      return api.gitActions.execute({
        ...request(),
        action,
        preparationId,
        requestId,
      });
    },
    onSuccess: accept,
  });
  const recovery = useMutation({
    mutationFn: async () => {
      if (!operation) throw new Error('No operation to recover');
      return api.gitActions.receipt({
        ...request(),
        requestId: operation.requestId,
      });
    },
    onSuccess: accept,
  });
  const terminal =
    operation?.receipt &&
    ['succeeded', 'no-change', 'rejected', 'conflicted'].includes(
      operation.receipt.state,
    );
  return {
    cancelPreparation: () => preparation.reset(),
    prepare: asMutation(preparation),
    preparation: preparation.data,
    execute: asMutation(execution),
    recover: asMutation(recovery),
    operation,
    startNew: () => {
      if (terminal) {
        client.setQueryData(key, null);
        preparation.reset();
        execution.reset();
        recovery.reset();
      }
    },
    canStartNew: Boolean(terminal),
  };
}
