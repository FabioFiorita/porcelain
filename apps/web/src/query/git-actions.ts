import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import type {
  ActionInput,
  CommitDraftInput,
  Expectation,
  GitAction,
  Receipt,
} from '../domain/git-action';
import type { ReviewScope } from '../domain/review';
import { createId } from '../lib/id';
import { queryKeys } from './keys';
import { refreshGitReceipt } from './live-updates';
import { asMutation } from './mutation';
import { isTerminal, operationKey } from './operation-store';
import { useConnectedContext } from './workspace-provider';

export function useGitAction(scope: ReviewScope, action: GitAction) {
  const { api, connection } = useConnectedContext();
  const client = useQueryClient();
  const { operations } = connection;
  const key = operationKey(scope, action);
  const operation = useSyncExternalStore(
    operations.subscribe,
    useCallback(() => operations.get(key), [operations, key]),
  );
  const request = () => ({ ...scope, ...connection.request() });
  async function accept(receipt: Receipt) {
    connection.controller.signal.throwIfAborted();
    if (
      receipt.projectId !== scope.projectId ||
      receipt.worktreeId !== scope.worktreeId ||
      receipt.action !== action ||
      receipt.requestId !== operations.get(key)?.requestId
    )
      throw new Error('Receipt identity mismatch');
    await refreshGitReceipt(client, connection.environmentId, receipt);
    connection.controller.signal.throwIfAborted();
    operations.accept(receipt);
    return receipt;
  }
  const execution = useMutation({
    mutationFn: async ({
      input,
      expected,
    }: {
      input: ActionInput;
      expected: Expectation;
    }) => {
      const previous = operations.get(key);
      if (previous && (!previous.receipt || !isTerminal(previous.receipt)))
        throw new Error(
          'Check the existing receipt before starting another operation.',
        );
      if (input.action !== action) throw new Error('Action mismatch');
      const body = { requestId: createId(), input, expected };
      operations.set(key, {
        ...scope,
        requestId: body.requestId,
        request: body,
      });
      await accept(await api.gitActions.run({ ...request(), input: body }));
      return operations.wait(key, connection.controller.signal);
    },
  });
  const recovery = useMutation({
    mutationFn: async () => {
      const current = operations.get(key);
      if (!current) throw new Error('No operation to recover');
      // Same request ID and payload recover both a lost response and a request
      // that never reached the server. The server enforces durable deduplication.
      await accept(
        await api.gitActions.run({ ...request(), input: current.request }),
      );
      return operations.wait(key, connection.controller.signal);
    },
  });
  const terminal = operation?.receipt && isTerminal(operation.receipt);
  return {
    run: (input: ActionInput, expected: Expectation) =>
      execution.mutateAsync({ input, expected }),
    execute: asMutation(execution),
    recover: asMutation(recovery),
    operation,
    startNew: () => {
      if (terminal) {
        operations.set(key, null);
        execution.reset();
        recovery.reset();
      }
    },
    canStartNew: Boolean(terminal),
  };
}

export function useCommitModels() {
  const { api, connection } = useConnectedContext();
  return useQuery({
    queryKey: queryKeys.commitModels(connection.environmentId),
    queryFn: ({ signal }) =>
      api.gitActions.models({
        ...connection.request(),
        signal: AbortSignal.any([signal, connection.controller.signal]),
      }),
    staleTime: 60_000,
  });
}
export function useCommitDraft(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  // Generation returns an editable proposal and does not mutate Git or review state.
  // react-doctor-disable-next-line react-doctor/query-mutation-missing-invalidation
  return asMutation(
    useMutation({
      mutationFn: ({
        signal,
        ...input
      }: CommitDraftInput & { signal?: AbortSignal }) =>
        api.gitActions.draft({
          ...scope,
          ...connection.request(signal),
          input,
        }),
    }),
  );
}

export function useBranches(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return useQuery({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'branches',
    ]),
    queryFn: ({ signal }) =>
      api.gitActions.branches({ ...scope, ...connection.request(signal) }),
    staleTime: 0,
  });
}

export function useDismissInterrupted(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (requestId: string) =>
        api.gitActions.dismissInterrupted({
          ...scope,
          ...connection.request(),
          requestId,
        }),
      onSuccess: () =>
        client.invalidateQueries({
          queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
            'changes',
          ]),
          exact: true,
        }),
    }),
  );
}
