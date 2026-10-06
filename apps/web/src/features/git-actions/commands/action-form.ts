import { COMMIT_MESSAGE_BYTES } from '@porcelain/contracts/shared';
import { useAtom, useAtomSet } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import { Cause, Effect } from 'effect';
import { useState } from 'react';
import type {
  FormAction,
  ActionInput,
  GitScope,
  GitActionStatus,
} from '@porcelain/client/git-actions/rules';
import {
  expectationFor,
  gitErrorMessage,
} from '@porcelain/client/git-actions/rules';
import { useGitAction } from './run-action';
import { type ConnectionContext } from '@/shared/workspace/connection';

export function useActionForm(
  scope: GitScope,
  action: FormAction,
  context: ConnectionContext,
  {
    expectedStatus,
    onBusy,
    onLookAgain,
  }: {
    expectedStatus: GitActionStatus;
    onBusy: (busy: boolean) => void;
    onLookAgain?: (() => Promise<void>) | undefined;
  },
) {
  const git = useGitAction(scope, action, context);
  const [lookCommand] = useState(() =>
    Atom.fn(
      (input: { read: () => Promise<void>; startNew: () => Promise<void> }) =>
        Effect.tryPromise({
          try: async () => {
            await input.read();
            await input.startNew();
          },
          catch: (cause) =>
            new Cause.UnknownError(cause, gitErrorMessage(cause)),
        }),
    ),
  );
  const [look, reread] = useAtom(lookCommand, { mode: 'promiseExit' });
  const resetLook = useAtomSet(lookCommand);
  const busy = git.execution.waiting || look.waiting;
  const uncertain = Boolean(git.operation && !git.canStartNew);
  const failure = (result: AsyncResult.AsyncResult<unknown, unknown>) =>
    AsyncResult.isFailure(result) ? Cause.squash(result.cause) : null;
  return {
    operation: git.operation,
    messageLimit: COMMIT_MESSAGE_BYTES,
    outcome: git.operation?.receipt,
    busy,
    uncertain,
    error: failure(git.execution) ?? failure(look) ?? failure(git.recovered),
    onSubmit: (input: ActionInput) => {
      if (busy || uncertain) return;
      onBusy(true);
      resetLook(Atom.Reset);
      git.reset();
      void git
        .run(
          input,
          expectationFor(
            expectedStatus,
            expectedStatus.files?.map((file) => file.path) ?? [],
            undefined,
            true,
          ),
        )
        .finally(() => onBusy(false))
        .catch(() => undefined);
    },
    lookAgain: () => {
      if (!onLookAgain || busy) return;
      git.reset();
      void reread({ read: onLookAgain, startNew: git.startNew });
    },
    checkOutcome: () => {
      git.reset();
      resetLook(Atom.Reset);
      void git.recover().catch(() => undefined);
    },
  };
}
