import type {
  ReadChangesResponse,
  ReadGitStatusResponse,
} from '@porcelain/contracts/changes';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type {
  ActionInput,
  GitScope,
} from '@porcelain/client/git-actions/rules';
import {
  expectationFor,
  gitErrorMessage,
  type GitNotice,
  receiptFailed,
  receiptWords,
} from '@porcelain/client/git-actions/rules';
import {
  type NetworkAction,
  networkInput,
  networkTarget,
  networkTitle,
} from '@porcelain/client/git-actions/rules';
import {
  type GitActionStatus,
  statusFromChanges,
} from '@porcelain/client/git-actions/rules';
import { restoreStash } from './restore-stash';
import { useGitAction } from './run-action';
import { type ConnectionContext } from '@/shared/workspace/connection';

type DiscardedItem = { oid: string; path: string; kind: 'hunk' | 'rename' };

type Menu = {
  details: {
    result: AsyncResult.AsyncResult<ReadGitStatusResponse, unknown>;
    read: () => Promise<ReadGitStatusResponse>;
  };
  enableDetails: () => void;
  pullStrategy: 'merge' | 'rebase';
  notify: (notice: GitNotice) => void;
  onProgress: (open: boolean) => void;
  onResult: (notice: GitNotice) => void;
};

type Runner = ReturnType<typeof useGitAction>;

async function runNetwork(
  menu: Menu,
  runner: Runner,
  next: NetworkAction,
  displayedBranch: GitActionStatus['branch'],
) {
  const { details } = menu;
  const notify = menu.onResult;
  const label = networkTitle(next);
  try {
    const status = AsyncResult.isSuccess(details.result)
      ? details.result.value
      : undefined;
    const freshlyRead = !status;
    if (freshlyRead) menu.enableDetails();
    const target = networkTarget(
      status ?? (await details.read()),
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
    menu.onProgress(true);
    const receipt = await runner.run(
      input,
      expectationFor(looked, [], looked.branch?.upstreamOid ?? null),
    );
    menu.onProgress(false);
    notify({
      title: receiptFailed(receipt) ? `${label} did not run` : label,
      description: receiptWords(receipt),
      type: receiptFailed(receipt) ? 'error' : 'success',
    });
  } catch (error) {
    menu.onProgress(false);
    notify({
      title: `${label} did not run`,
      description: gitErrorMessage(error),
      type: 'error',
    });
  }
}

async function restoreDiscarded(
  menu: Menu,
  runner: Runner,
  item: DiscardedItem,
) {
  const { details, notify } = menu;
  const label =
    item.kind === 'rename' ? `rename of ${item.path}` : `hunk of ${item.path}`;
  try {
    let looked = Option.getOrUndefined(AsyncResult.value(details.result));
    if (!looked || AsyncResult.isFailure(details.result)) {
      menu.enableDetails();
      looked = await details.read();
    }
    await restoreStash(
      runner,
      { stashOid: item.oid, restoreIndex: item.kind === 'rename' },
      expectationFor(looked, [item.path], undefined, true),
      notify,
      {
        restored: `Restored the discarded ${label}`,
        failed: `Could not restore the discarded ${label}`,
      },
    );
  } catch (error) {
    notify({
      title: `Could not restore the discarded ${label}`,
      description: gitErrorMessage(error),
      type: 'error',
    });
  }
}

export function useGitMenu(
  scope: GitScope,
  context: ConnectionContext,
  menu: Menu & {
    refreshLook: () => Promise<ReadChangesResponse>;
    onLooked: (status: GitActionStatus) => void;
  },
) {
  const fetchAction = useGitAction(scope, 'fetch', context);
  const pullAction = useGitAction(scope, 'pull', context);
  const pushAction = useGitAction(scope, 'push', context);
  const restoreAction = useGitAction(scope, 'stash-apply', context);
  const runners = { fetch: fetchAction, pull: pullAction, push: pushAction };
  const running = (['fetch', 'pull', 'push'] as const)
    .map((name) => ({
      name,
      operation: runners[name].operation,
      canStartNew: runners[name].canStartNew,
    }))
    .find(({ operation, canStartNew }) => operation != null && !canStartNew);
  return {
    running,
    runNetwork: (
      next: NetworkAction,
      displayedBranch: GitActionStatus['branch'],
    ) => void runNetwork(menu, runners[next], next, displayedBranch),
    restoreDiscarded: (item: DiscardedItem) =>
      void restoreDiscarded(menu, restoreAction, item),
    lookAgain: async () => {
      menu.onLooked(statusFromChanges(await menu.refreshLook()));
    },
  };
}
