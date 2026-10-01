import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ActionInput,
  Expectation,
  GitAction,
  GitScope,
  Receipt,
} from '../rules/git-action';
import { useGitOperation } from '../store';
import { createId } from '@/shared/lib/id';
import { asMutation } from '@/shared/query/mutation';
import { isTerminal, operationKey } from '@/shared/query/operation-store';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { gitActionsApi } from '../api';
import { refreshGitReceipt } from './live-updates';

export function useGitAction(
  scope: GitScope,
  action: GitAction,
  context: ConnectionContext,
) {
  const { connection } = context;
  const client = useQueryClient();
  const { operations } = connection;
  const key = operationKey(scope, action);
  const operation = useGitOperation(operations, key);
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
      await accept(
        await gitActionsApi(connection).run({ ...request(), input: body }),
      );
      return operations.wait(key, connection.controller.signal);
    },
  });
  const recovery = useMutation({
    mutationFn: async () => {
      const current = operations.get(key);
      if (!current) throw new Error('No operation to recover');
      await accept(
        await gitActionsApi(connection).run({
          ...request(),
          input: current.request,
        }),
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
