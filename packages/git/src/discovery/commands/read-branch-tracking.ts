import { Effect } from 'effect';
import { gitRead } from '../../shared/commands/run-git.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';

export const readBranchTracking = Effect.fn('Git.readBranchTracking')(
  function* (checkout: string, branch: string, limits: GitLimits) {
    const read = (args: readonly string[]) =>
      gitRead(checkout, args, limits).pipe(
        Effect.map((bytes) => bytes.toString('utf8').trim()),
      );
    const configuration = (key: string) =>
      read(['config', '--get', key]).pipe(
        Effect.catchTag('GitCommandError', (error) =>
          error.exitCode === 1 ? Effect.succeed('') : Effect.fail(error),
        ),
      );
    const tracking = yield* read([
      'for-each-ref',
      '--format=%(upstream:remotename)%00%(upstream:remoteref)',
      `refs/heads/${branch}`,
    ]);
    const [trackedRemote, trackedRef] = tracking.split('\0');
    const remoteName =
      trackedRemote || (yield* configuration(`branch.${branch}.remote`));
    const remoteRef =
      trackedRef || (yield* configuration(`branch.${branch}.merge`));
    const urls = (push: boolean) =>
      remoteName && remoteName !== '.'
        ? read([
            'remote',
            'get-url',
            ...(push ? ['--push'] : []),
            '--all',
            remoteName,
          ]).pipe(
            Effect.map((value) => value.split('\n').filter(Boolean)),
            Effect.catchTag('GitCommandError', (error) =>
              error.exitCode === 2
                ? Effect.succeed([] as string[])
                : Effect.fail(error),
            ),
          )
        : Effect.succeed([] as string[]);
    return {
      remoteName,
      remoteRef,
      fetchUrls: yield* urls(false),
      pushUrls: yield* urls(true),
    };
  },
);
