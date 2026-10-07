import type { gitActionCommands } from './git-action-controller.ts';
import type { Cause } from 'effect';
import { Effect, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { ReadGitStatusResponse } from '@porcelain/contracts/changes';
import type { ActionInput } from '../rules/git-action.ts';
import type { GitNotice } from '../rules/feedback.ts';
import type { GitActionStatus } from '../rules/status.ts';
import type { NetworkAction } from '../rules/network.ts';
import {
  expectationFor,
  gitErrorMessage,
  receiptFailed,
  receiptWords,
} from '../rules/feedback.ts';
import { networkTitle, networkTarget, networkInput } from '../rules/network.ts';
import { restoreStash } from './restore-stash.ts';
export type DiscardedItem = {
  oid: string;
  path: string;
  kind: 'hunk' | 'rename';
};

export type GitMenuControls = {
  details: {
    result: AsyncResult.AsyncResult<ReadGitStatusResponse, unknown>;
    read: () => Effect.Effect<ReadGitStatusResponse, Cause.UnknownError>;
  };
  enableDetails: () => void;
  pullStrategy: 'merge' | 'rebase';
  notify: (notice: GitNotice) => void;
  onProgress: (open: boolean) => void;
  onResult: (notice: GitNotice) => void;
};

type Runner = Pick<ReturnType<typeof gitActionCommands>, 'run'>;

export const runNetworkAction = Effect.fn('GitMenu.runNetwork')(
  function* (
    menu: GitMenuControls,
    runner: Runner,
    next: NetworkAction,
    displayedBranch: GitActionStatus['branch'],
  ) {
    const { details } = menu;
    const notify = menu.onResult;
    const label = networkTitle(next);
    const status = AsyncResult.isSuccess(details.result)
      ? details.result.value
      : undefined;
    const freshlyRead = !status;
    if (freshlyRead) menu.enableDetails();
    const target = networkTarget(
      status ?? (yield* details.read()),
      displayedBranch,
      freshlyRead,
    );
    if (!target.ready) {
      notify({
        title: `${label} did not run`,
        description: target.reason,
        type: 'error',
      });
      return;
    }
    const { looked } = target;
    const input: ActionInput = networkInput(
      next,
      looked.branch,
      menu.pullStrategy,
    );
    const receipt = yield* Effect.acquireUseRelease(
      Effect.sync(() => menu.onProgress(true)),
      () =>
        runner.run(
          input,
          expectationFor(looked, [], looked.branch?.upstreamOid ?? null),
        ),
      () => Effect.sync(() => menu.onProgress(false)),
    );
    notify({
      title: receiptFailed(receipt) ? `${label} did not run` : label,
      description: receiptWords(receipt),
      type: receiptFailed(receipt) ? 'error' : 'success',
    });
  },
  (effect, menu, _runner, next) =>
    effect.pipe(
      Effect.catch((error) =>
        Effect.sync(() =>
          menu.onResult({
            title: `${networkTitle(next)} did not run`,
            description: gitErrorMessage(error),
            type: 'error',
          }),
        ),
      ),
    ),
);

export const restoreDiscardedItem = Effect.fn('GitMenu.restoreDiscarded')(
  function* (menu: GitMenuControls, runner: Runner, item: DiscardedItem) {
    const { details, notify } = menu;
    const label =
      item.kind === 'rename'
        ? `rename of ${item.path}`
        : `hunk of ${item.path}`;
    let looked = Option.getOrUndefined(AsyncResult.value(details.result));
    if (!looked || AsyncResult.isFailure(details.result)) {
      menu.enableDetails();
      looked = yield* details.read();
    }
    yield* restoreStash(
      runner,
      { stashOid: item.oid, restoreIndex: item.kind === 'rename' },
      expectationFor(looked, [item.path], undefined, true),
      notify,
      {
        restored: `Restored the discarded ${label}`,
        failed: `Could not restore the discarded ${label}`,
      },
    );
  },
  (effect, menu, _runner, item) =>
    effect.pipe(
      Effect.catch((error) =>
        Effect.sync(() =>
          menu.notify({
            title: `Could not restore the discarded ${item.kind === 'rename' ? `rename of ${item.path}` : `hunk of ${item.path}`}`,
            description: gitErrorMessage(error),
            type: 'error',
          }),
        ),
      ),
    ),
);
