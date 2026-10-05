import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type {
  ActionInput,
  Expectation,
  GitAction,
  GitScope,
} from '@porcelain/client/git-actions/rules';
import { useGitOperation } from '../store';
import { createId } from '@/shared/lib/id';
import { asMutation } from '@/shared/query/mutation';
import { isTerminal, operationKey } from '@porcelain/client/git-actions';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { GitActionController } from '@porcelain/client/git-actions';
import { runRequest } from '@porcelain/client/transport';

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
    const previous = operations.state.value.operations.get(key);
    return previous?.receipt && isTerminal(previous.receipt)
      ? previous.requestId
      : null;
  });
  const followed = useGitOperation(operations, key);
  const operation = followed?.requestId === settledBefore ? null : followed;
  const controller = new GitActionController(
    scope,
    action,
    connection,
    operations,
    client,
    connection.controller.signal,
    createId,
  );
  const execution = useMutation({
    mutationFn: (input: { input: ActionInput; expected: Expectation }) =>
      runRequest(controller.execute(input), connection.request().signal),
  });
  const recovery = useMutation({
    mutationFn: () =>
      runRequest(controller.recover(), connection.request().signal),
  });
  const terminal = operation?.receipt && isTerminal(operation.receipt);
  return {
    run: (input: ActionInput, expected: Expectation) =>
      execution.mutateAsync({ input, expected }),
    execute: asMutation(execution),
    recover: asMutation(recovery),
    operation,
    startNew: async () => {
      if (
        await runRequest(controller.startNew(), connection.request().signal)
      ) {
        execution.reset();
        recovery.reset();
      }
    },
    canStartNew: Boolean(terminal),
  };
}
