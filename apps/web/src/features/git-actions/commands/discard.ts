import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import { useAtom, useAtomSet } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import { Cause, Effect, Option } from 'effect';
import { useState } from 'react';
import type { GitScope } from '@porcelain/client/git-actions/rules';
import {
  expectationFor,
  gitErrorMessage,
  type GitNotice,
} from '@porcelain/client/git-actions/rules';
import { type GitActionStatus } from '@porcelain/client/git-actions/rules';
import { DISCARD_RESTORE_TOAST_MS } from '@/config/limits';
import {
  finishDiscard,
  type DiscardFailure,
  type Discarding,
} from '@porcelain/client/git-actions';
import { useGitAction } from './run-action';
import { type ConnectionContext } from '@/shared/workspace/connection';

type Hunk = {
  scope: 'staged' | 'unstaged';
  startLine: number;
  endLine: number;
};

export function useDiscard(
  scope: GitScope,
  context: ConnectionContext,
  {
    path,
    hunk,
    what,
    look,
    readChanges,
    notify,
    dismissNotice,
    close,
  }: {
    path: string;
    hunk: Hunk | undefined;
    what: string;
    look: GitActionStatus | null;
    readChanges: () => Promise<ReadChangesResponse>;
    notify: (notice: GitNotice) => string;
    dismissNotice: (id: string) => void;
    close: () => void;
  },
) {
  const discard = useGitAction(scope, 'discard', context);
  const restore = useGitAction(scope, 'stash-apply', context);
  const uncertain = Boolean(discard.operation && !discard.canStartNew);
  const discarding = {
    what,
    readChanges: () =>
      Effect.tryPromise({
        try: readChanges,
        catch: (cause) => new Cause.UnknownError(cause, gitErrorMessage(cause)),
      }),
    notify,
    dismissNotice,
    close,
    restore,
    restoreTimeoutMs: DISCARD_RESTORE_TOAST_MS,
    run: Effect.runFork,
  };

  const [submitCommand] = useState(() =>
    Atom.fn(
      (input: {
        run: () => ReturnType<ReturnType<typeof useGitAction>['run']>;
        discarding: Discarding;
      }) => finishDiscard(input.run(), input.discarding),
    ),
  );
  const [recoverCommand] = useState(() =>
    Atom.fn(
      (input: {
        recover: () => ReturnType<ReturnType<typeof useGitAction>['run']>;
        discarding: Discarding;
      }) => finishDiscard(input.recover(), input.discarding),
    ),
  );
  const [submitted, submit] = useAtom(submitCommand, { mode: 'promiseExit' });
  const [recovered, recover] = useAtom(recoverCommand, { mode: 'promiseExit' });
  const resetSubmit = useAtomSet(submitCommand);
  const resetRecover = useAtomSet(recoverCommand);
  const busy = submitted.waiting || recovered.waiting;
  const failure = (result: typeof submitted): DiscardFailure | null =>
    Option.getOrUndefined(AsyncResult.value(result)) ??
    (AsyncResult.isFailure(result)
      ? { text: gitErrorMessage(Cause.squash(result.cause)), moved: false }
      : null);
  return {
    operation: discard.operation,
    uncertain,
    busy,
    error: failure(submitted) ?? failure(recovered),
    reset: () => {
      resetSubmit(Atom.Reset);
      resetRecover(Atom.Reset);
    },
    run: () => {
      if (busy || uncertain || !look) return;
      resetRecover(Atom.Reset);
      void submit({
        run: () =>
          discard.run(
            { action: 'discard', path, ...(hunk ? { hunk } : {}) },
            expectationFor(look, [path]),
          ),
        discarding,
      });
    },
    checkOutcome: () => {
      if (busy) return;
      resetSubmit(Atom.Reset);
      void recover({ recover: discard.recover, discarding });
    },
  };
}
