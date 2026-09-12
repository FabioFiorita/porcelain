import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import type { ActionInput, GitAction, Receipt } from '../domain/git-action';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useConnectedContext } from './workspace-provider';

const terminalStates: Receipt['state'][] = [
  'succeeded',
  'no-change',
  'rejected',
  'conflicted',
];

export function useGitAction(scope: ReviewScope, action: GitAction) {
  const { api, connection } = useConnectedContext();
  const client = useQueryClient();
  const { operations } = connection;
  const key = JSON.stringify([scope.projectId, scope.worktreeId, action]);
  const operation = useSyncExternalStore(
    operations.subscribe,
    useCallback(() => operations.get(key), [operations, key]),
  );
  const request = () => ({ ...scope, ...connection.request() });
  async function accept(receipt: Receipt) {
    if (connection.controller.signal.aborted) return;
    const expected = operations.get(key);
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
    operations.set(key, {
      requestId: receipt.requestId,
      preparationId: receipt.preparationId,
      receipt,
    });
    if (receipt.refreshRequired)
      await client.invalidateQueries({
        queryKey: queryKeys.reviewProject(
          connection.environmentId,
          scope.projectId,
        ),
      });
  }
  // Preparation reads and captures state; it has no Git/cache effects.
  // react-doctor-disable-next-line react-doctor/query-mutation-missing-invalidation
  const preparation = useMutation({
    mutationFn: (input: ActionInput) =>
      api.gitActions.prepare({ ...request(), action, input }),
  });
  const execution = useMutation({
    mutationFn: async (preparationId: string) => {
      if (operations.get(key))
        throw new Error(
          'Check the existing receipt before starting another operation.',
        );
      const requestId = crypto.randomUUID();
      operations.set(key, { requestId, preparationId });
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
    operation?.receipt && terminalStates.includes(operation.receipt.state);
  return {
    cancelPreparation: () => preparation.reset(),
    prepare: asMutation(preparation),
    preparation: preparation.data,
    execute: asMutation(execution),
    recover: asMutation(recovery),
    operation,
    startNew: () => {
      if (terminal) {
        operations.set(key, null);
        preparation.reset();
        execution.reset();
        recovery.reset();
      }
    },
    canStartNew: Boolean(terminal),
  };
}
