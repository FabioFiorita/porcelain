import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import { useMutation } from '@tanstack/react-query';
import type { GitScope, Receipt } from '../rules/git-action';
import {
  changedSinceLooked,
  expectationFor,
  gitErrorMessage,
  type GitNotice,
  receiptFailed,
  receiptWords,
} from '../rules/feedback';
import { type GitActionStatus, statusFromChanges } from '../rules/status';
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
