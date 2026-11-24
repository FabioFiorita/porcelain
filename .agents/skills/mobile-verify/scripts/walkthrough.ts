import { Schema } from 'effect';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ServerHandle,
  type Recorder,
} from '@porcelain/server/kit/isolated-server';
import { scriptedWalkthroughs } from '@porcelain/server/kit/walkthrough-fixture';
import {
  fixtureCheckResults,
  fixtureScreenshot,
} from '@porcelain/server/kit/fixture-screenshot';
import { Usage } from '../../verify-core/cli.ts';

type Content = Parameters<
  Awaited<ReturnType<typeof scriptedWalkthroughs>>['write']
>[0];

const SHORT_ANSWER =
  'Keep the retry beside its owner. The `local` boundary is deliberate.';
const LONG_ANSWER = [
  'Keeping the retry beside its owner means the owner decides how often to try again, how long to wait between attempts and when to give up.',
  'Moving it to a shared helper would hide that choice from the reader and make every caller inherit the same timing, even the ones that should fail fast.',
  'The `local` boundary is deliberate: it keeps the decision where the behavior lives, and it is cheap to move later if a second owner ever needs the same policy.',
].join(' ');

const stop = (
  title: string,
  path: string,
  call: boolean,
): Content['stops'][number] => ({
  title,
  explanation: 'Keep the behavior close to its owner, so a reader finds it.',
  blocks: [
    ...(call
      ? [
          {
            kind: 'callout' as const,
            attention: {
              kind: 'product' as const,
              question: 'Keep retries local to their owner?',
              note: 'Either choice ships; only the owner can pick the boundary.',
            },
            comparison: {
              columns: ['Keep it local', 'Share a helper'],
              rows: [
                ['The owner sees the timing', 'Every caller gets one timing'],
                ['Moves later if needed', 'Harder to fail fast'],
              ],
            },
          },
          {
            kind: 'diff_excerpt' as const,
            path,
            side: 'new' as const,
            start: 1,
            end: 1,
            caption: 'The owner decides when to try again.',
          },
        ]
      : []),
    { kind: 'files', files: [{ path, note: 'Owns the behavior' }] },
  ],
});

export async function walkthroughCommand(
  manifest: string,
  ids: { projectId: string; worktreeId: string },
  rest: readonly string[],
  recorder: Recorder,
): Promise<string> {
  const [kind, argument] = rest;
  const handle = await ServerHandle.attach(manifest);
  const session = handle.session(recorder, ids);
  const failure = join(session.projectHome, 'conversation-failure');
  const posts = join(session.projectHome, 'conversation-posts');
  if (kind === 'posts') return readFile(posts, 'utf8');
  if (kind === 'moved') {
    await session.git(
      'remote',
      'set-url',
      'origin',
      'https://github.com/example/elsewhere.git',
    );
    return 'origin now points at another repository; posts are refused\n';
  }
  if (kind !== 'sample' && kind !== 'answer')
    throw new Usage(
      'Use walkthrough sample, walkthrough answer long|short, walkthrough moved or walkthrough posts.',
    );
  const { bin } = Schema.decodeUnknownSync(
    Schema.Struct({ bin: Schema.String }),
  )(JSON.parse(await readFile(manifest, 'utf8')));
  await rm(join(bin, 'claude'), { force: true });
  const writer = await scriptedWalkthroughs(session, manifest, {
    answer: SHORT_ANSWER,
    costUsd: 0.01,
    failurePath: failure,
    postsPath: posts,
  });
  if (kind === 'answer') {
    await writer.reply(argument === 'long' ? LONG_ANSWER : SHORT_ANSWER);
    return `the next answer is ${argument === 'long' ? 'long' : 'short'}\n`;
  }
  await session
    .git('remote', 'add', 'origin', 'https://github.com/example/sample.git')
    .catch(() => undefined);
  await session.git('branch', '-f', 'walkthrough-sample-base');
  await session.git('checkout', '-B', 'walkthrough-sample');
  await session.writeFile('retry-owner.txt', 'The owner retries.\n');
  await session.writeFile('retry-notes.txt', 'Why the owner retries.\n');
  await session.git('add', 'retry-owner.txt', 'retry-notes.txt');
  await session.git('commit', '-m', 'Keep retries beside their owner');
  const content: Content = {
    version: 1,
    outcome: 'needs_you',
    title: 'Keep retries beside their owner',
    summary:
      'Before, every caller retried on its own. Now the `owner` decides when to try again, and one call is left for you.',
    growth: [
      { change: 'added', what: 'Retry owner', note: 'One place decides.' },
      { change: 'changed', what: 'Notes', note: 'They explain why.' },
    ],
    stops: [
      stop('Retry boundary', 'retry-owner.txt', true),
      stop('Failure handling', 'retry-notes.txt', false),
    ],
    onlyInTranscript: [
      { point: 'Why local.', answer: 'The owner asked for it.' },
    ],
    stillUnclear: ['Whether a second owner will need the same policy.'],
  };
  const run = await writer.write(content, {
    base: 'refs/heads/walkthrough-sample-base',
    pullRequestNumber: 423,
  });
  if (run.state.status !== 'ready')
    throw new Error('The sample walkthrough did not finish.');
  await writer.attachEvidence(
    run.id,
    2,
    [
      {
        id: 'sample-screen-1',
        mediaType: 'image/png',
        caption: 'The retry setting on its owner',
        bytes: fixtureScreenshot([37, 99, 235]),
      },
      {
        id: 'sample-screen-2',
        mediaType: 'image/png',
        caption: 'The failure message after three tries',
        bytes: fixtureScreenshot([220, 38, 38]),
      },
    ],
    {
      state: 'FAILURE',
      checksTruncated: false,
      results: fixtureCheckResults,
    },
  );
  return `wrote walkthrough ${run.id} for pull request #423 with checks and two screenshots on step 2\n`;
}
