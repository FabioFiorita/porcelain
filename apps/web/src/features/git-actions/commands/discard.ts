import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import { useMutation } from '@tanstack/react-query';
import type { GitContext } from '../api';
import type { GitScope, Receipt } from '../rules/git-action';
import {
  changedSinceLooked,
  expectationFor,
  gitErrorMessage,
  receiptFailed,
  receiptWords,
} from '../rules/feedback';
import { type GitActionStatus, statusFromChanges } from '../rules/status';
import { DISCARD_RESTORE_TOAST_MS } from '@/config/limits';
import { useGitAction } from './run-action';

type Hunk = {
  scope: 'staged' | 'unstaged';
  startLine: number;
  endLine: number;
};

type DiscardNotice = {
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info';
  timeout?: number;
  actionProps?: { children: string; onClick: () => void };
};

type DiscardToasts = {
  add: (notice: DiscardNotice) => string;
  close: (id: string) => void;
};

type DiscardFailure = { text: string; moved: boolean };

type Discarding = {
  what: string;
  readChanges: () => Promise<ReadChangesResponse>;
  toasts: DiscardToasts;
  close: () => void;
  restore: ReturnType<typeof useGitAction>;
};

async function restoreDiscarded(
  { what, readChanges, toasts, restore }: Discarding,
  stashOid: string,
  restoreIndex: boolean,
  toastId: string,
) {
  let restoreLook: GitActionStatus;
  try {
    restoreLook = statusFromChanges(await readChanges());
  } catch (cause) {
    toasts.add({
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
  toasts.close(toastId);
  let failure: string | null;
  try {
    const result = await restore.run(
      { action: 'stash-apply', stashOid, restoreIndex },
      expectationFor(restoreLook, currentPaths, undefined, true),
    );
    failure = receiptFailed(result) ? receiptWords(result) : null;
  } catch (cause) {
    failure = gitErrorMessage(cause);
  }
  toasts.add(
    failure === null
      ? { title: `Restored ${what}`, type: 'success' }
      : {
          title: `Could not restore ${what}`,
          description: failure,
          type: 'error',
        },
  );
}

function finish(
  discarding: Discarding,
  receipt: Receipt,
): DiscardFailure | null {
  const { what, toasts, close } = discarding;
  if (receiptFailed(receipt))
    return { text: receiptWords(receipt), moved: changedSinceLooked(receipt) };
  close();
  const stashOid = receipt.result?.restoreStashOid;
  if (receipt.state === 'no-change') {
    toasts.add({
      title: 'Nothing to discard',
      description: `${what} already matches the last commit.`,
      type: 'info',
    });
    return null;
  }
  const restoreIndex = receipt.result?.restoreIndex ?? false;
  const toastId: string = toasts.add({
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
                toastId,
              ),
          },
        }
      : {}),
  });
  return null;
}

export function useDiscard(
  scope: GitScope,
  context: GitContext,
  {
    path,
    hunk,
    what,
    look,
    readChanges,
    toasts,
    close,
  }: {
    path: string;
    hunk: Hunk | undefined;
    what: string;
    look: GitActionStatus | null;
    readChanges: () => Promise<ReadChangesResponse>;
    toasts: DiscardToasts;
    close: () => void;
  },
) {
  const discard = useGitAction(scope, 'discard', context);
  const restore = useGitAction(scope, 'stash-apply', context);
  const uncertain = Boolean(discard.operation && !discard.canStartNew);
  const discarding = { what, readChanges, toasts, close, restore };

  const submit = useMutation({
    mutationFn: async (looked: GitActionStatus) =>
      finish(
        discarding,
        await discard.run(
          { action: 'discard', path, ...(hunk ? { hunk } : {}) },
          expectationFor(looked, [path]),
        ),
      ),
  });
  const recover = useMutation({
    mutationFn: async () => finish(discarding, await discard.recover.submit()),
  });
  const busy = submit.isPending || recover.isPending;
  const failure = (
    data: DiscardFailure | null | undefined,
    error: unknown,
  ): DiscardFailure | null =>
    data ?? (error ? { text: gitErrorMessage(error), moved: false } : null);

  return {
    operation: discard.operation,
    uncertain,
    busy,
    error:
      failure(submit.data, submit.error) ??
      failure(recover.data, recover.error),
    reset: () => {
      submit.reset();
      recover.reset();
    },
    run: () => {
      if (busy || uncertain || !look) return;
      recover.reset();
      submit.mutate(look);
    },
    checkOutcome: () => {
      if (busy) return;
      submit.reset();
      recover.mutate();
    },
  };
}
