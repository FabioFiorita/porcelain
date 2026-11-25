import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import type { ChildProcessSpawner } from 'effect/process';
import { Schema } from 'effect';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Effect } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { expect, it, onTestFinished } from 'vite-plus/test';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';
import {
  listGitHubAccounts,
  mergeGitHubPullRequest,
  postGitHubIssueComment,
  postGitHubPullRequestReview,
  readGitHubApi,
} from './github-read.ts';
async function fixture(onCleanup: (fn: () => Promise<void> | void) => void) {
  const folder = await mkdtemp(join(temporaryRoot, 'porcelain-gh-'));
  onCleanup(() => rm(folder, { recursive: true, force: true }));
  const original = {
    PATH: process.env.PATH,
    GH_TOKEN: process.env.GH_TOKEN,
    GH_DEBUG: process.env.GH_DEBUG,
  };
  onCleanup(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const state = join(folder, 'state');
  const calls = join(folder, 'calls');
  await writeFile(state, 'ok');
  await writeFile(
    join(folder, 'gh'),
    `#!${process.execPath}
import fs from 'node:fs';
const args = process.argv.slice(2);
const mode = fs.readFileSync(${JSON.stringify(state)}, 'utf8');
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ args, token: process.env.GH_TOKEN, debug: process.env.GH_DEBUG }) + '\\n');
if (args[0] === 'auth' && args[1] === 'status') { console.log('["personal","work"]'); }
else if (args[0] === 'auth') { console.log('secret-' + args.at(-1)); }
else if (args.includes('repos/o/r/issues/7/comments')) { fs.writeFileSync(${JSON.stringify(join(folder, 'posted'))}, fs.readFileSync(0)); console.log('{"html_url":"https://github.com/o/r/pull/7#issuecomment-1"}'); }
else if (args.includes('repos/o/r/pulls/7/reviews')) { fs.writeFileSync(${JSON.stringify(join(folder, 'review'))}, fs.readFileSync(0)); console.log('{"id":9,"html_url":"https://github.com/o/r/pull/7#pullrequestreview-9"}'); }
else if (args.includes('repos/o/r/pulls/7/merge') && mode === 'ok') { fs.writeFileSync(${JSON.stringify(join(folder, 'posted'))}, fs.readFileSync(0)); console.log('{"sha":"abc","merged":true,"message":"Pull Request successfully merged"}'); }
else if (args.includes('repos/o/r/pulls/7/merge') && mode === 'blocked') { console.error('gh: Required status check "unit" is expected. (HTTP 405)'); process.exitCode = 1; }
else if (args.includes('repos/o/r/pulls/7/merge') && mode === 'moved') { console.error('gh: Head branch was modified. Review and try the merge again. (HTTP 409)'); process.exitCode = 1; }
else if (mode === 'rate') { console.error('HTTP 403 API rate limit exceeded ' + process.env.GH_TOKEN); process.exitCode = 1; }
else if (mode === 'offline') { console.error('dial tcp: network is unreachable ' + process.env.GH_TOKEN); process.exitCode = 1; }
else if (mode === 'missing-pull') { console.error('GraphQL: Could not resolve to a PullRequest with the number of 999. (repository.pullRequest) ' + process.env.GH_TOKEN); process.exitCode = 1; }
else if (mode === 'no-access') { console.error('HTTP 404 Not Found ' + process.env.GH_TOKEN); process.exitCode = 1; }
else if (mode === 'leak') { console.log(process.env.GH_TOKEN); }
else if (mode === 'large') { console.log('x'.repeat(3000)); }
else if (mode === 'hang') { setTimeout(() => {}, 30000); }
else { console.log('{"repository":"allowed"}'); }
`,
    { mode: 0o755 },
  );
  process.env.PATH = folder;
  process.env.GH_TOKEN = 'ambient-secret';
  process.env.GH_DEBUG = 'api';
  return { state, calls, folder };
}
const run = <A, E>(
  effect: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>,
) => Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)));
it('uses only the selected account token for one API call and strips ambient tokens and debug logging', async ({
  onTestFinished,
}) => {
  const f = await fixture(onTestFinished);
  expect(await run(listGitHubAccounts(gitLimits))).toEqual([
    'personal',
    'work',
  ]);
  expect(
    await run(
      readGitHubApi({ account: 'work', endpoint: 'repos/a/b' }, gitLimits),
    ),
  ).toBe('{"repository":"allowed"}\n');
  expect(
    (await readFile(f.calls, 'utf8'))
      .trim()
      .split('\n')
      .map((line) =>
        Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(line),
      ),
  ).toEqual([
    {
      args: [
        'auth',
        'status',
        '--hostname',
        'github.com',
        '--json',
        'hosts',
        '--jq',
        '[.hosts["github.com"][]?.login]',
      ],
    },
    { args: ['auth', 'token', '--hostname', 'github.com', '--user', 'work'] },
    {
      args: ['api', '--hostname', 'github.com', 'repos/a/b', '--method', 'GET'],
      token: 'secret-work',
    },
  ]);
  expect(process.env.GH_TOKEN).toBe('ambient-secret');
});
it.each([
  ['rate', 'rate-limited'],
  ['offline', 'offline'],
  ['no-access', 'no-access'],
  ['missing-pull', 'not-found'],
  ['leak', 'invalid-response'],
  ['large', 'invalid-response'],
  ['hang', 'offline'],
] as const)('bounds and sanitizes %s failures', async (mode, reason) => {
  const f = await fixture(onTestFinished);
  await writeFile(f.state, mode);
  const result = await run(
    readGitHubApi(
      { account: 'work', endpoint: 'repos/a/b' },
      {
        ...gitLimits,
        readTimeoutMs: mode === 'hang' ? 100 : 5000,
        outputBytes: 1024,
      },
    ).pipe(Effect.result),
  );
  expect(result._tag).toBe('Failure');
  if (result._tag === 'Failure') expect(result.failure.reason).toBe(reason);
  expect(JSON.stringify(result)).not.toContain('secret-work');
});
it('sends a comment body over 128 KiB through stdin instead of the argument list', async ({
  onTestFinished,
}) => {
  const f = await fixture(onTestFinished);
  const body = '語'.repeat(60000);
  expect(
    await run(
      postGitHubIssueComment(
        { account: 'work', owner: 'o', repo: 'r', number: 7, body },
        gitLimits,
      ),
    ),
  ).toBe('https://github.com/o/r/pull/7#issuecomment-1');
  expect(await readFile(join(f.folder, 'posted'), 'utf8')).toBe(
    JSON.stringify({ body }),
  );
  expect(await readFile(f.calls, 'utf8')).not.toContain('語');
});

it('reports a missing gh executable without leaking a spawn error', async ({
  onTestFinished,
}) => {
  const f = await fixture(onTestFinished);
  await rm(join(f.folder, 'gh'));
  const result = await run(listGitHubAccounts(gitLimits).pipe(Effect.result));
  expect(result._tag === 'Failure' ? result.failure.reason : 'unexpected').toBe(
    'gh-not-installed',
  );
});

const merge = {
  account: 'work',
  owner: 'o',
  repo: 'r',
  number: 7,
  method: 'squash',
  headSha: 'a'.repeat(40),
} as const;
it('merges with the chosen method only when the head is still the commit that was read', async ({
  onTestFinished,
}) => {
  const f = await fixture(onTestFinished);
  await run(mergeGitHubPullRequest(merge, gitLimits));
  expect(JSON.parse(await readFile(join(f.folder, 'posted'), 'utf8'))).toEqual({
    merge_method: 'squash',
    sha: 'a'.repeat(40),
  });
  const call = (await readFile(f.calls, 'utf8')).trim().split('\n').at(-1)!;
  expect(JSON.parse(call)).toMatchObject({
    args: [
      'api',
      '--hostname',
      'github.com',
      'repos/o/r/pulls/7/merge',
      '--method',
      'PUT',
      '--input',
      '-',
    ],
    token: 'secret-work',
  });
});
it.each([
  ['blocked', 'not-mergeable', 'Required status check "unit" is expected.'],
  [
    'moved',
    'head-changed',
    'Head branch was modified. Review and try the merge again.',
  ],
  ['rate', 'rate-limited', undefined],
] as const)(
  'reports a %s merge as %s with what GitHub said',
  async (mode, reason, detail) => {
    const f = await fixture(onTestFinished);
    await writeFile(f.state, mode);
    const result = await run(
      mergeGitHubPullRequest(merge, gitLimits).pipe(Effect.result),
    );
    expect(result._tag).toBe('Failure');
    if (result._tag !== 'Failure') return;
    expect(result.failure.reason).toBe(reason);
    expect('detail' in result.failure ? result.failure.detail : undefined).toBe(
      detail,
    );
    expect(JSON.stringify(result)).not.toContain('secret-work');
  },
);

it('posts one COMMENT review at the given commit with single and multi-line comments on their side', async ({
  onTestFinished,
}) => {
  const f = await fixture(onTestFinished);
  expect(
    await run(
      postGitHubPullRequestReview(
        {
          account: 'work',
          owner: 'o',
          repo: 'r',
          number: 7,
          commitId: 'abc123',
          body: 'Summary',
          comments: [
            { path: 'src/a.ts', side: 'RIGHT', line: 4, body: 'One line' },
            {
              path: 'src/b.ts',
              side: 'LEFT',
              startLine: 2,
              line: 3,
              body: 'Removed range',
            },
          ],
        },
        gitLimits,
      ),
    ),
  ).toBe('https://github.com/o/r/pull/7#pullrequestreview-9');
  expect(JSON.parse(await readFile(join(f.folder, 'review'), 'utf8'))).toEqual(
    {
      commit_id: 'abc123',
      event: 'COMMENT',
      body: 'Summary',
      comments: [
        { path: 'src/a.ts', side: 'RIGHT', line: 4, body: 'One line' },
        {
          path: 'src/b.ts',
          side: 'LEFT',
          line: 3,
          body: 'Removed range',
          start_line: 2,
          start_side: 'LEFT',
        },
      ],
    },
  );
  const reviewCall = (await readFile(f.calls, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { args: string[]; token: string })
    .find((call) => call.args.includes('repos/o/r/pulls/7/reviews'));
  expect(reviewCall).toEqual({
    args: [
      'api',
      '--hostname',
      'github.com',
      'repos/o/r/pulls/7/reviews',
      '--method',
      'POST',
      '--input',
      '-',
    ],
    token: 'secret-work',
  });
});
