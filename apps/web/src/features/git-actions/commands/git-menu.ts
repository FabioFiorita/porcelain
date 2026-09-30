import type {
  ReadChangesResponse,
  ReadGitStatusResponse,
} from '@porcelain/contracts/changes';
import type { ActionInput, GitScope } from '../rules/git-action';
import {
  expectationFor,
  gitErrorMessage,
  type GitNotice,
  receiptFailed,
  receiptWords,
} from '../rules/feedback';
import {
  type NetworkAction,
  networkInput,
  networkTarget,
  networkTitle,
} from '../rules/network';
import { type GitActionStatus, statusFromChanges } from '../rules/status';
import { restoreStash } from './restore-stash';
import { useGitAction } from './run-action';
import { type ConnectionContext } from '@/shared/workspace/connection';

type DiscardedItem = { oid: string; path: string; kind: 'hunk' | 'rename' };

type Menu = {
  details: {
    status: ReadGitStatusResponse | undefined;
    read: () => Promise<ReadGitStatusResponse | undefined>;
  };
  enableDetails: () => void;
  pullStrategy: 'merge' | 'rebase';
  notify: (notice: GitNotice) => void;
  onProgress: (open: boolean) => void;
};

type Runner = ReturnType<typeof useGitAction>;

async function runNetwork(
  menu: Menu,
  runner: Runner,
  next: NetworkAction,
  displayedBranch: GitActionStatus['branch'],
) {
  const { details, notify } = menu;
  const label = networkTitle(next);
  const freshlyRead = !details.status;
  if (freshlyRead) menu.enableDetails();
  const target = networkTarget(
    details.status ?? (await details.read()),
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
  let input: ActionInput;
  try {
    input = networkInput(next, looked.branch, menu.pullStrategy);
  } catch (error) {
    notify({
      title: `${label} did not run`,
      description: gitErrorMessage(error),
      type: 'error',
    });
    return;
  }
  menu.onProgress(true);
  try {
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
  let looked = details.status;
  if (!looked) {
    menu.enableDetails();
    looked = await details.read();
  }
  if (!looked) {
    notify({
      title: 'Could not restore the discarded change',
      description: 'The worktree status is still loading. Try again.',
      type: 'error',
    });
    return;
  }
  const label =
    item.kind === 'rename' ? `rename of ${item.path}` : `hunk of ${item.path}`;
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
