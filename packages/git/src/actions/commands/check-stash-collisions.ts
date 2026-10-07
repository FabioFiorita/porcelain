import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readActionCommand } from './read-action-command.ts';

export const checkStashCollisions = Effect.fn('Git.checkStashCollisions')(
  function* (
    process: GitProcessRunner,
    stashOid: string,
  ): Effect.fn.Return<void, ActionFailure, ActionPlatform> {
    const ignored = (yield* readActionCommand(process, [
      'ls-files',
      '--others',
      '--ignored',
      '--exclude-standard',
      '-z',
    ]))
      .split('\0')
      .filter(Boolean);
    if (!ignored.length) return;
    const paths = (yield* readActionCommand(process, [
      'ls-tree',
      '-r',
      '--name-only',
      '-z',
      stashOid,
    ]))
      .split('\0')
      .filter(Boolean);
    const third = yield* process.execute([
      'rev-parse',
      '--verify',
      '--quiet',
      `${stashOid}^3`,
    ]);
    const failure = processFailure(third);
    if (failure?.state === 'indeterminate')
      return yield* new GitActionRejectedError({
        reason: failure.reason ?? 'GIT_REJECTED',
      });
    const untracked =
      third.exitCode === 0
        ? (yield* readActionCommand(process, [
            'ls-tree',
            '-r',
            '--name-only',
            '-z',
            `${stashOid}^3`,
          ]))
            .split('\0')
            .filter(Boolean)
        : [];
    const collisions = [...paths, ...untracked].some((path) =>
      ignored.some(
        (entry) =>
          entry === path ||
          entry.startsWith(`${path}/`) ||
          path.startsWith(`${entry}/`),
      ),
    );
    if (collisions)
      return yield* new GitActionRejectedError({ reason: 'CHECKOUT_BUSY' });
  },
);
