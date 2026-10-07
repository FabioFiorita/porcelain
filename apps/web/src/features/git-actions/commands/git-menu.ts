import { gitErrorMessage } from '@porcelain/client/git-actions/rules';
import { Cause, Effect } from 'effect';
import type {
  ReadChangesResponse,
  ReadGitStatusResponse,
} from '@porcelain/contracts/changes';
import type { AsyncResult } from 'effect/reactivity';
import type {
  GitScope,
  GitActionStatus,
  GitNotice,
  NetworkAction,
} from '@porcelain/client/git-actions/rules';
import {
  runNetworkAction,
  refreshGitLook,
  restoreDiscardedItem,
  type DiscardedItem,
} from '@porcelain/client/git-actions';
import { useGitAction } from './run-action';
import type { ConnectionContext } from '@/shared/workspace/connection';

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
  const controls = {
    ...menu,
    details: {
      ...menu.details,
      read: () =>
        Effect.tryPromise({
          try: menu.details.read,
          catch: (cause) =>
            new Cause.UnknownError(cause, gitErrorMessage(cause)),
        }),
    },
  };
  const runners = { fetch: fetchAction, pull: pullAction, push: pushAction };
  const running = (['fetch', 'pull', 'push'] as const)
    .map((name) => ({
      name,
      operation: runners[name].operation,
      canStartNew: runners[name].canStartNew,
    }))
    .find(
      ({ operation, canStartNew }) =>
        operation !== null && operation !== undefined && !canStartNew,
    );
  return {
    running,
    runNetwork: (
      next: NetworkAction,
      displayedBranch: GitActionStatus['branch'],
    ) =>
      Effect.runFork(
        runNetworkAction(controls, runners[next], next, displayedBranch),
      ),
    restoreDiscarded: (item: DiscardedItem) =>
      Effect.runFork(restoreDiscardedItem(controls, restoreAction, item)),
    lookAgain: () =>
      Effect.runPromise(
        refreshGitLook(
          Effect.tryPromise({
            try: menu.refreshLook,
            catch: (cause) =>
              new Cause.UnknownError(cause, gitErrorMessage(cause)),
          }),
          menu.onLooked,
        ),
      ),
  };
}
