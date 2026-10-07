import { useConfirmedRead } from '@/shared/query/confirmed-read';
import { useAtomValue } from '@effect/atom-react';
import { useState } from 'react';
import type { GitAction, GitScope } from '@porcelain/client/git-actions/rules';
import {
  isTerminal,
  operationKey,
  runGitAction,
  recoverGitAction,
  readGitActionCommands,
} from '@porcelain/client/git-actions';
import { useGitOperation } from '../store';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function useGitAction(
  scope: GitScope,
  action: GitAction,
  context: ConnectionContext,
) {
  const { connection } = context;
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
  const selection = { connection, scope, action };
  const { value: commands } = useConfirmedRead(
    readGitActionCommands(selection),
  );
  const execute = runGitAction(selection);
  const recovery = recoverGitAction(selection);
  const execution = useAtomValue(execute);
  const recovered = useAtomValue(recovery);
  return {
    ...commands,
    execution,
    recovered,
    operation,
    canStartNew: Boolean(operation?.receipt && isTerminal(operation.receipt)),
  };
}
