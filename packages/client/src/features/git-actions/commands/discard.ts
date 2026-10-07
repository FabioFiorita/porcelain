import type { gitActionCommands } from './git-action-controller.ts';
import type { Cause } from 'effect';
import { Effect } from 'effect';
import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import type { Receipt } from '../rules/git-action.ts';
import type { GitNotice } from '../rules/feedback.ts';
import {
  changedSinceLooked,
  expectationFor,
  gitErrorMessage,
  receiptFailed,
  receiptWords,
} from '../rules/feedback.ts';
import { statusFromChanges } from '../rules/status.ts';
import { restoreStash } from './restore-stash.ts';
export type DiscardFailure = { text: string; moved: boolean };

export type Discarding = {
  restoreTimeoutMs: number;
  what: string;
  readChanges: () => Effect.Effect<ReadChangesResponse, Cause.UnknownError>;
  notify: (notice: GitNotice) => string;
  dismissNotice: (id: string) => void;
  close: () => void;
  run: (effect: Effect.Effect<void>) => void;
  restore: Pick<ReturnType<typeof gitActionCommands>, 'run'>;
};

const restoreDiscarded = Effect.fn('Discard.restore')(function* (
  { what, readChanges, notify, dismissNotice, restore }: Discarding,
  stashOid: string,
  restoreIndex: boolean,
  noticeId: string,
) {
  const restoreLook = yield* readChanges().pipe(
    Effect.map(statusFromChanges),
    Effect.catch((cause) =>
      Effect.sync(() => {
        notify({
          title: `Could not restore ${what}`,
          description: gitErrorMessage(cause),
          type: 'error',
        });
        return null;
      }),
    ),
  );
  if (!restoreLook) return;
  const currentPaths =
    restoreLook.files
      ?.filter((entry) => entry.fingerprint != null)
      .map((entry) => entry.path) ?? [];
  dismissNotice(noticeId);
  yield* restoreStash(
    restore,
    { stashOid, restoreIndex },
    expectationFor(restoreLook, currentPaths, undefined, true),
    notify,
    { restored: `Restored ${what}`, failed: `Could not restore ${what}` },
  );
});

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
    timeout: discarding.restoreTimeoutMs,
    ...(stashOid
      ? {
          actionProps: {
            children: 'Restore',
            onClick: () =>
              discarding.run(
                restoreDiscarded(discarding, stashOid, restoreIndex, noticeId),
              ),
          },
        }
      : {}),
  });
  return null;
}

export const finishDiscard = Effect.fn('Discard.finish')(function* (
  receipt: ReturnType<ReturnType<typeof gitActionCommands>['run']>,
  discarding: Discarding,
) {
  return finish(discarding, yield* receipt);
});
