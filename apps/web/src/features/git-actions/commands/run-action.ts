import { useAtom, useAtomSet } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { Cause, Exit } from 'effect';
import { useState } from 'react';
import type {
  ActionInput,
  Expectation,
  GitAction,
  GitScope,
} from '@porcelain/client/git-actions/rules';
import {
  isTerminal,
  operationKey,
  runGitAction,
  recoverGitAction,
  startNewGitAction,
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
  const execute = runGitAction(selection);
  const recovery = recoverGitAction(selection);
  const [execution, run] = useAtom(execute, { mode: 'promiseExit' });
  const [recovered, recover] = useAtom(recovery, { mode: 'promiseExit' });
  const [, startNew] = useAtom(startNewGitAction(selection), {
    mode: 'promiseExit',
  });
  const resetExecute = useAtomSet(execute);
  const resetRecovery = useAtomSet(recovery);
  return {
    run: async (input: ActionInput, expected: Expectation) => {
      const result = await run({ input, expected });
      if (Exit.isFailure(result)) throw Cause.squash(result.cause);
      return result.value;
    },
    recover: async () => {
      const result = await recover();
      if (Exit.isFailure(result)) throw Cause.squash(result.cause);
      return result.value;
    },
    execution,
    recovered,
    operation,
    startNew: async () => {
      const result = await startNew();
      if (Exit.isFailure(result)) throw Cause.squash(result.cause);
      if (result.value) {
        resetExecute(Atom.Reset);
        resetRecovery(Atom.Reset);
      }
    },
    reset: () => {
      resetExecute(Atom.Reset);
      resetRecovery(Atom.Reset);
    },
    canStartNew: Boolean(operation?.receipt && isTerminal(operation.receipt)),
  };
}
