import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Effect, Layer } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { expect, it, onTestFinished } from 'vite-plus/test';
import {
  GitHubPullRequestActions,
  GitHubPullRequestMerger,
  GitHubReader,
} from '@porcelain/reviews/ports';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';
import { makeGitHubAccessMemo } from './github-access-memo.ts';
import { ghPullRequestActionsLayer } from './gh-pull-request-actions.ts';
import { ghPullRequestMergerLayer } from './gh-pull-request-merger.ts';
import { ghPullRequestReaderLayer } from './gh-pull-request-reader.ts';

const repository = { owner: 'o', repo: 'r' };
const target = { ...repository, account: 'work' };

async function fakeGitHub(onCleanup: (fn: () => Promise<void> | void) => void) {
  const folder = await mkdtemp(join(temporaryRoot, 'porcelain-gh-access-'));
  const path = process.env.PATH;
  onCleanup(async () => {
    process.env.PATH = path;
    await rm(folder, { recursive: true, force: true });
  });
  const state = join(folder, 'state');
  const calls = join(folder, 'calls');
  await writeFile(state, 'granted');
  await writeFile(calls, '');
  await writeFile(
    join(folder, 'gh'),
    `#!${process.execPath}
import fs from 'node:fs';
const args = process.argv.slice(2);
const access = fs.readFileSync(${JSON.stringify(state)}, 'utf8');
if (args[0] === 'auth' && args[1] === 'status') console.log('["work"]');
else if (args[0] === 'auth') console.log('token-' + args.at(-1));
else {
  fs.appendFileSync(${JSON.stringify(calls)}, args[3] + '\\n');
  if (access === 'revoked') { console.error('gh: Resource not accessible by personal access token (HTTP 403)'); process.exitCode = 1; }
  else if (args[3] === 'repos/o/r') console.log('{"full_name":"o/r"}');
  else console.log('{}');
}
`,
    { mode: 0o755 },
  );
  process.env.PATH = folder;
  return {
    revoke: () => writeFile(state, 'revoked'),
    probes: async () =>
      (await readFile(calls, 'utf8'))
        .split('\n')
        .filter((endpoint) => endpoint === 'repos/o/r').length,
  };
}

const outcome = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.map(Effect.result(effect), (result) => result._tag);

const refusals = [
  [
    'a merge',
    Effect.gen(function* () {
      const merger = yield* GitHubPullRequestMerger;
      return yield* outcome(
        merger.merge({
          ...target,
          number: 7,
          method: 'squash',
          headSha: 'a'.repeat(40),
        }),
      );
    }),
  ],
  [
    'a comment',
    Effect.gen(function* () {
      const actions = yield* GitHubPullRequestActions;
      return yield* outcome(
        actions.comment({ ...target, number: 7, body: 'Looks good' }),
      );
    }),
  ],
  [
    'a check re-run',
    Effect.gen(function* () {
      const actions = yield* GitHubPullRequestActions;
      return yield* outcome(
        actions.rerun({ ...target, target: { kind: 'job', jobId: 9 } }),
      );
    }),
  ],
  [
    'a pull request read',
    Effect.gen(function* () {
      const reader = yield* GitHubReader;
      return yield* outcome(reader.read({ ...target, number: 7 }));
    }),
  ],
] as const;

it.each(refusals)(
  'asks GitHub again for access after it refuses %s for lack of access, instead of trusting the access it saw minutes ago',
  async (_name, refusal) => {
    const github = await fakeGitHub(onTestFinished);
    const access = await Effect.runPromise(makeGitHubAccessMemo);
    const adapters = Layer.mergeAll(
      ghPullRequestReaderLayer(gitLimits, access),
      ghPullRequestMergerLayer(gitLimits, access),
      ghPullRequestActionsLayer(gitLimits, access),
    ).pipe(Layer.provide(NodeServices.layer));
    const readable = Effect.gen(function* () {
      const reader = yield* GitHubReader;
      return yield* reader.canRead(target);
    });
    const run = <A, E>(
      effect: Effect.Effect<A, E, Layer.Success<typeof adapters>>,
    ) => Effect.runPromise(effect.pipe(Effect.provide(adapters)));

    expect(await run(readable)).toBe(true);
    expect(await run(readable)).toBe(true);
    expect(await github.probes()).toBe(1);

    await github.revoke();
    expect(await run(refusal)).toBe('Failure');

    expect(await run(readable)).toBe(false);
    expect(await github.probes()).toBe(2);
  },
);
