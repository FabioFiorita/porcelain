import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { gitRead } from '../../shared/commands/run-git.ts';

const remoteExitCodes = { noSuchRemote: 2 };

export const readOriginUrl = Effect.fn('Git.readOriginUrl')(function* (
  checkout: string,
  limits: GitLimits,
) {
  const output = yield* gitRead(
    checkout,
    ['remote', 'get-url', 'origin'],
    limits,
  ).pipe(
    Effect.catchIf(
      (failure) =>
        failure._tag === 'GitCommandError' &&
        failure.exitCode === remoteExitCodes.noSuchRemote,
      () => Effect.succeed(undefined),
    ),
  );
  const url = output?.toString('utf8').trim();
  return url === '' ? undefined : url;
});
