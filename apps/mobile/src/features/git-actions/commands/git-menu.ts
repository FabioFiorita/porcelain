import {
  useAtom,
  useAtomRef,
  useAtomSet,
  useAtomValue,
} from '@effect/atom-react';
import { readCurrentGitStatus, readGitStatus } from '@porcelain/client/changes';
import {
  networkMenuAttemptNotice,
  type NetworkMenuAttempt,
  networkMenuFeedback,
  networkMenuNotice,
  readGitActionCommands,
  recoverGitAction,
  recoverNetworkAction,
  runNetworkAction,
  type GitMenuControls,
} from '@porcelain/client/git-actions';
import {
  networkActionBlocker,
  gitActionLabel,
  gitErrorMessage,
} from '@porcelain/client/git-actions/rules';
import { readReviewGitSettingsView } from '@porcelain/client/preferences';
import {
  reviewGitPullStrategy,
  reviewGitSettingsBlock,
} from '@porcelain/client/preferences/rules';
import { Cause, Effect, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { Workspace } from '../../projects';

export function useGitMenu(selection: Pick<Workspace, 'connection' | 'scope'>) {
  const { connection, scope } = selection;
  const status = useAtomValue(readGitStatus(selection));
  const read = useAtomSet(readCurrentGitStatus(selection), { mode: 'promise' });
  const settings = useAtomValue(readReviewGitSettingsView(connection));
  const strategy = reviewGitPullStrategy(settings);
  const fetchCommands = useAtomValue(
    readGitActionCommands({ ...selection, action: 'fetch' }),
  );
  const pullCommands = useAtomValue(
    readGitActionCommands({ ...selection, action: 'pull' }),
  );
  const fetching = useAtomValue(
    recoverGitAction({ ...selection, action: 'fetch' }),
  );
  const pulling = useAtomValue(
    recoverGitAction({ ...selection, action: 'pull' }),
  );
  const operations = useAtomRef(connection.operations.state);
  const [notice, setNotice] = useAtom(networkMenuNotice({ connection, scope }));
  const feedback = networkMenuFeedback(operations, scope, notice);
  const running = feedback.running;
  const runners = { fetch: fetchCommands, pull: pullCommands };
  const remember = (
    attempt: NetworkMenuAttempt,
    notice: Parameters<GitMenuControls['onResult']>[0],
  ) => {
    const result = networkMenuAttemptNotice(
      connection.operations.state.value,
      scope,
      attempt,
      notice,
    );
    if (result) setNotice(result);
  };
  const controlsFor = (attempt: NetworkMenuAttempt): GitMenuControls => ({
    details: {
      result: status,
      read: () =>
        Effect.tryPromise({
          try: () => read(undefined),
          catch: (cause) =>
            new Cause.UnknownError(cause, gitErrorMessage(cause)),
        }),
    },
    enableDetails: () => undefined,
    pull: strategy
      ? { kind: 'ready', strategy }
      : {
          kind: 'blocked',
          reason:
            reviewGitSettingsBlock(settings) ??
            'Reviews & Git settings for this computer are unavailable.',
        },
    notify: (notice) => remember(attempt, notice),
    onProgress: (open) => {
      if (open) setNotice(null);
    },
    onResult: (notice) => remember(attempt, notice),
  });
  const value = Option.getOrUndefined(AsyncResult.value(status));
  const blocker = (action: 'fetch' | 'pull') => {
    if (running) return 'A Git action is in progress.';
    if (AsyncResult.isFailure(status))
      return 'Read Git status again before continuing.';
    if (!value) return 'Reading Git status…';
    if (!AsyncResult.isSuccess(runners[action]))
      return 'Preparing Git actions…';
    return networkActionBlocker(
      action,
      value,
      strategy ? undefined : reviewGitSettingsBlock(settings),
    );
  };
  const run = (action: 'fetch' | 'pull') => {
    const commands = runners[action];
    const attempt: NetworkMenuAttempt = {
      action,
      previous: networkMenuFeedback(connection.operations.state.value, scope)
        .selected?.operation,
    };
    const reason = blocker(action);
    if (reason || !AsyncResult.isSuccess(commands)) {
      remember(attempt, {
        title: `${gitActionLabel(action)} did not run`,
        description: reason ?? 'Preparing Git actions…',
        type: 'error',
      });
      return;
    }
    const runner = commands.value;
    Effect.runFork(
      runNetworkAction(
        controlsFor(attempt),
        {
          run: (next, expected) => {
            return runner.run(next, expected, (request) => {
              attempt.request = request;
            });
          },
        },
        action,
        value?.branch,
      ),
    );
  };
  return {
    blocker,
    run,
    running,
    checking: running?.action === 'pull' ? pulling.waiting : fetching.waiting,
    result: feedback.result,
    retry: () => {
      const action = feedback.retryAction;
      if (action) run(action);
    },
    checkOutcome: () => {
      if (!running) return;
      const commands = runners[running.action];
      const attempt: NetworkMenuAttempt = {
        action: running.action,
        previous: running.operation,
        request: running.operation.request,
      };
      if (AsyncResult.isSuccess(commands)) {
        Effect.runFork(
          recoverNetworkAction(
            controlsFor(attempt),
            commands.value,
            running.action,
          ),
        );
      } else {
        remember(attempt, {
          title: `${gitActionLabel(running.action)} outcome not confirmed`,
          description: AsyncResult.isFailure(commands)
            ? gitErrorMessage(Cause.squash(commands.cause))
            : 'Preparing Git actions…',
          type: 'error',
        });
      }
    },
  };
}
