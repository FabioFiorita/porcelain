import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { GitCommandError } from '../../shared/errors/git-command-error.ts';
import type { GitOutputLimitError } from '../../shared/errors/git-output-limit-error.ts';
import type { GitTimeoutError } from '../../shared/errors/git-timeout-error.ts';
import { gitRead } from '../../shared/commands/run-git.ts';
import { HistorySnapshotUnavailableError } from '../../shared/errors/history-snapshot-unavailable-error.ts';
import { ReadLimitExceededError } from '../../shared/errors/read-limit-exceeded-error.ts';

export const runHistory = Effect.fn('Git.runHistory')(
  (checkout: string, args: readonly string[], limits: GitLimits) =>
    read(checkout, args, limits).pipe(Effect.mapError(historyFailure)),
);

export const askHistory = Effect.fn('Git.askHistory')(
  (
    checkout: string,
    args: readonly string[],
    limits: GitLimits,
    answersNo: (failure: GitCommandError) => boolean,
  ) =>
    readHistoryAnswer(checkout, args, limits, answersNo).pipe(
      Effect.map((answer) => answer !== null),
    ),
);

export const readHistoryAnswer = Effect.fn('Git.readHistoryAnswer')(
  (
    checkout: string,
    args: readonly string[],
    limits: GitLimits,
    answersNone: (failure: GitCommandError) => boolean,
  ) =>
    read(checkout, args, limits).pipe(
      Effect.catchTag('GitCommandError', (failure) =>
        answersNone(failure) ? Effect.succeed(null) : Effect.fail(failure),
      ),
      Effect.mapError(historyFailure),
    ),
);

function read(checkout: string, args: readonly string[], limits: GitLimits) {
  return gitRead(checkout, args, limits, {
    leading: ['--literal-pathspecs'],
    config: ['log.showSignature=false'],
  });
}

function historyFailure(
  cause: GitCommandError | GitOutputLimitError | GitTimeoutError,
) {
  if (cause._tag === 'GitOutputLimitError')
    return new ReadLimitExceededError({ cause });
  if (cause._tag === 'GitCommandError' && cause.exitCode !== undefined)
    return new HistorySnapshotUnavailableError({ cause });
  return cause;
}
