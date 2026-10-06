import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import { useAtom, useAtomSet } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import { Cause, Effect, Option } from 'effect';
import { useState } from 'react';
import type { GitScope, Receipt } from '@porcelain/client/git-actions/rules';
import {
  changedSinceLooked,
  expectationFor,
  gitErrorMessage,
  type GitNotice,
  receiptFailed,
  receiptWords,
} from '@porcelain/client/git-actions/rules';
import {
  type GitActionStatus,
  statusFromChanges,
} from '@porcelain/client/git-actions/rules';
import { DISCARD_RESTORE_TOAST_MS } from '@/config/limits';
import { restoreStash } from './restore-stash';
import { useGitAction } from './run-action';
import { type ConnectionContext } from '@/shared/workspace/connection';

type Hunk = {
  scope: 'staged' | 'unstaged';
  startLine: number;
  endLine: number;
};

type DiscardFailure = { text: string; moved: boolean };

type Discarding = {
  what: string;
  readChanges: () => Promise<ReadChangesResponse>;
  notify: (notice: GitNotice) => string;
  dismissNotice: (id: string) => void;
  close: () => void;
  restore: ReturnType<typeof useGitAction>;
};

async function restoreDiscarded(
  { what, readChanges, notify, dismissNotice, restore }: Discarding,
  stashOid: string,
  restoreIndex: boolean,
  noticeId: string,
) {
  let restoreLook: GitActionStatus;
  try {
    restoreLook = statusFromChanges(await readChanges());
  } catch (cause) {
    notify({
      title: `Could not restore ${what}`,
      description: gitErrorMessage(cause),
      type: 'error',
    });
    return;
  }
  const currentPaths =
    restoreLook.files
      ?.filter((entry) => entry.fingerprint != null)
      .map((entry) => entry.path) ?? [];
  dismissNotice(noticeId);
  await restoreStash(
    restore,
    { stashOid, restoreIndex },
    expectationFor(restoreLook, currentPaths, undefined, true),
    notify,
    { restored: `Restored ${what}`, failed: `Could not restore ${what}` },
  );
}

function finish(
  discarding: Discarding,
  receipt: Receipt,
): DiscardFailure | null {
  const { what, notify, close } = discarding;
  if (receiptFailed(receipt))
    return { text: receiptWords(receipt), moved: changedSinceLooked(receipt) };
  close();
  const stashOid = receipt.result?.restoreStashOid;
  if (receipt.state === 'no-change') {
    notify({
      title: 'Nothing to discard',
      description: `${what} already matches the last commit.`,
      type: 'info',
    });
    return null;
  }
  const restoreIndex = receipt.result?.restoreIndex ?? false;
  const noticeId: string = notify({
    title: `Discarded ${what}`,
    type: 'success',
    timeout: DISCARD_RESTORE_TOAST_MS,
    ...(stashOid
      ? {
          actionProps: {
            children: 'Restore',
            onClick: () =>
              void restoreDiscarded(
                discarding,
                stashOid,
                restoreIndex,
                noticeId,
              ),
          },
        }
      : {}),
  });
  return null;
}

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
    readChanges,
    notify,
    dismissNotice,
    close,
    restore,
  };

  const [submitCommand] = useState(() =>
    Atom.fn((input: { run: () => Promise<Receipt>; discarding: Discarding }) =>
      Effect.tryPromise({
        try: async () => finish(input.discarding, await input.run()),
        catch: (cause) => new Cause.UnknownError(cause, gitErrorMessage(cause)),
      }),
    ),
  );
  const [recoverCommand] = useState(() =>
    Atom.fn(
      (input: { recover: () => Promise<Receipt>; discarding: Discarding }) =>
        Effect.tryPromise({
          try: async () => finish(input.discarding, await input.recover()),
          catch: (cause) =>
            new Cause.UnknownError(cause, gitErrorMessage(cause)),
        }),
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
