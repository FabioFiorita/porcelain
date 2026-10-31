import { Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import { GitHubReader } from '../ports/github-reader.ts';
import { ReadGitHubPullChecksService } from './read-github-pull-checks-service.ts';
import type { GitHubPullChecks } from '../models/pull-request.ts';
import { GitHubReadError } from '../errors/github-read-error.ts';
const input = {
  owner: 'owner',
  repo: 'project',
  account: 'personal',
  number: 42,
};
function read(value: Effect.Effect<GitHubPullChecks, GitHubReadError>) {
  const calls: unknown[] = [];
  const layer = ReadGitHubPullChecksService.layer.pipe(
    Layer.provide(
      Layer.succeed(GitHubReader, {
        accounts: () => Effect.die('No account listing'),
        canRead: () => Effect.die('No account probing'),
        read: () => Effect.die('No full PR read'),
        list: () => Effect.die('No repository-wide PR listing'),
        checks: (target) => {
          calls.push(target);
          return value;
        },
      }),
    ),
  );
  return {
    calls,
    result: Effect.runPromise(
      Effect.flatMap(ReadGitHubPullChecksService, (service) =>
        service.execute(input),
      ).pipe(Effect.provide(layer)),
    ),
  };
}
it.each([
  ['SUCCESS', 'passed'],
  ['PENDING', 'running'],
  ['EXPECTED', 'running'],
  ['FAILURE', 'failed'],
  ['ERROR', 'failed'],
] as const)(
  'maps the GitHub %s aggregate without reading full PR details',
  async (state, checks) => {
    const subject = read(
      Effect.succeed({
        number: 42,
        commits: { nodes: [{ commit: { statusCheckRollup: { state } } }] },
      }),
    );
    expect(await subject.result).toEqual({ number: 42, checks });
    expect(subject.calls).toEqual([input]);
  },
);
it.each([{ nodes: [] }])('keeps absent checks neutral', async (commits) => {
  const subject = read(Effect.succeed({ number: 42, commits }));
  expect(await subject.result).toEqual({ number: 42, checks: 'none' });
});
it('preserves GitHub failures instead of reporting passed checks', async () => {
  const subject = read(Effect.fail(new GitHubReadError({ reason: 'offline' })));
  await expect(subject.result).rejects.toMatchObject({
    _tag: 'GitHubReadError',
    reason: 'offline',
  });
});
