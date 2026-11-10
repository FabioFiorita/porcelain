import { useAtomRef, useAtomSet, useAtomValue } from '@effect/atom-react';
import { readCurrentGitStatus, readGitStatus } from '@porcelain/client/changes';
import {
  isTerminal,
  operationKey,
  readGitActionCommands,
  recoverNetworkAction,
  runNetworkAction,
  type GitMenuControls,
} from '@porcelain/client/git-actions';
import {
  networkActionBlocker,
  gitErrorMessage,
  type GitNotice,
} from '@porcelain/client/git-actions/rules';
import { readReviewGitSettingsView } from '@porcelain/client/preferences';
import {
  reviewGitPullStrategy,
  reviewGitSettingsBlock,
} from '@porcelain/client/preferences/rules';
import { Cause, Effect, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useState } from 'react';
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
  const operations = useAtomRef(connection.operations.state);
  const [progress, setProgress] = useState(false);
  const [result, setResult] = useState<GitNotice | null>(null);
  const [last, setLast] = useState<'fetch' | 'pull'>('fetch');
  const runners = { fetch: fetchCommands, pull: pullCommands };
  const running = (['fetch', 'pull'] as const)
    .map((action) => ({
      action,
      operation: operations.operations.get(operationKey(scope, action)),
    }))
    .find(
      ({ operation }) =>
        operation && (!operation.receipt || !isTerminal(operation.receipt)),
    );
  const controls: GitMenuControls = {
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
    notify: setResult,
    onProgress: (open) => {
      if (open) setResult(null);
      setProgress(open);
    },
    onResult: setResult,
  };
  const value = Option.getOrUndefined(AsyncResult.value(status));
  const blocker = (action: 'fetch' | 'pull') => {
    if (running || progress) return 'A Git action is in progress.';
    if (AsyncResult.isFailure(status))
      return 'Read Git status again before continuing.';
    if (!value) return 'Reading Git status…';
    if (!AsyncResult.isSuccess(runners[action]))
      return 'Preparing Git actions…';
    return networkActionBlocker(
      action,
      value,
      controls.pull.kind === 'blocked' ? controls.pull.reason : undefined,
    );
  };
  const run = (action: 'fetch' | 'pull') => {
    const commands = runners[action];
    if (blocker(action) || !AsyncResult.isSuccess(commands)) return;
    setLast(action);
    Effect.runFork(
      runNetworkAction(controls, commands.value, action, value?.branch),
    );
  };
  return {
    blocker,
    run,
    running,
    progress,
    result,
    retry: () => run(last),
    checkOutcome: () => {
      if (!running) return;
      const commands = runners[running.action];
      if (AsyncResult.isSuccess(commands))
        Effect.runFork(
          recoverNetworkAction(controls, commands.value, running.action),
        );
    },
  };
}
