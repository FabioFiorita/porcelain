import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runInspection } from './run-inspection.ts';

const NOTHING_IGNORED = 1;

export const checkIgnored = Effect.fn('Git.checkIgnored')(function* (
  checkout: string,
  paths: readonly string[],
  limits: GitLimits,
) {
  const wanted = [...new Set(paths)];
  if (wanted.length === 0) return new Set<string>();
  const output = yield* runInspection(
    checkout,
    ['check-ignore', '-z', '--stdin'],
    limits,
    {
      maxBytes: limits.inspection.checkIgnoredBytes,
      input: Buffer.from(`${wanted.join('\0')}\0`),
    },
  ).pipe(
    Effect.catchTag('GitCommandError', (error) =>
      error.exitCode === NOTHING_IGNORED
        ? Effect.succeed(Buffer.alloc(0))
        : Effect.fail(error),
    ),
  );
  return new Set(output.toString('utf8').split('\0').filter(Boolean));
});
