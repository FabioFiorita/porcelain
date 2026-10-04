import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
import { gitActionCommands } from '@porcelain/client/git-actions';
import { assertCurrentAnswer } from '@porcelain/client/transport';
import { refreshGitReceipt } from './refresh-receipt';

export function useGitAction(
  scope: GitScope,
  action: GitAction,
  context: ConnectionContext,
) {
  const { connection } = context;
  const client = useQueryClient();
  const { operations } = connection;
  const key = operationKey(scope, action);
  const [settledBefore] = useState(() => {
    const previous = operations.get(key);
    return previous?.receipt && isTerminal(previous.receipt)
      ? previous.requestId
      : null;
  });
  const followed = useGitOperation(operations, key);
  const operation = followed?.requestId === settledBefore ? null : followed;
  const commands = gitActionCommands(scope, connection, client);
  async function accept(receipt: Receipt) {
    assertCurrentAnswer(connection.controller.signal);
    assertCurrentAnswer(
      connection.controller.signal,
      receipt.requestId === operations.get(key)?.requestId,
    );
    await refreshGitReceipt(client, connection.environmentId, receipt);
    assertCurrentAnswer(connection.controller.signal);
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
      await accept(await commands.run(body));
      return operations.wait(key, connection.controller.signal);
    },
  });
  const recovery = useMutation({
    mutationFn: async () => {
      const current = operations.get(key);
      if (!current) throw new Error('No operation to recover');
      await accept(await commands.run(current.request));
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
