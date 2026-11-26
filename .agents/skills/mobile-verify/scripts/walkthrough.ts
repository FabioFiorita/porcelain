import { Schema } from 'effect';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  ServerHandle,
  type Recorder,
} from '@porcelain/server/kit/isolated-server';
import { scriptedWalkthroughs } from '@porcelain/server/kit/walkthrough-fixture';
import {
  sampleWalkthroughCommits,
  sampleWalkthroughDraft,
} from '@porcelain/server/kit/walkthrough-sample';
import {
  fixtureCheckResults,
  fixtureScreenshot,
} from '@porcelain/server/kit/fixture-screenshot';
import { Usage } from '../../verify-core/cli.ts';

type Content = Parameters<
  Awaited<ReturnType<typeof scriptedWalkthroughs>>['write']
>[0];

const SHORT_ANSWER =
  'An empty query shows every note. The `findNotes` boundary is deliberate.';
const LONG_ANSWER = [
  'An empty query matches every title, because every string contains the empty string, so the first view lists all notes.',
  'Moving that choice into the view would hide it from the search and make every caller decide again, even the ones that only need matching.',
  'The `findNotes` boundary is deliberate: it keeps matching where the behavior lives, and it is cheap to change later if the owner prefers a quiet first view.',
].join(' ');

const secondCall = {
  kind: 'callout' as const,
  attention: {
    kind: 'tradeoff' as const,
    question: 'Keep the count wording beside the label?',
    note: 'Either choice ships; only the owner can pick where wording lives.',
  },
  comparison: {
    columns: ['Beside the label', 'In a copy table'],
    rows: [['One file to read', 'Every string in one place']],
  },
};

function sampleContent(): Content {
  const [first, second] = sampleWalkthroughDraft.stops;
  if (!first || !second) throw new Error('The sample has two steps.');
  return {
    ...sampleWalkthroughDraft,
    stops: [first, { ...second, blocks: [secondCall, ...second.blocks] }],
  };
}

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
  if (kind !== 'sample' && kind !== 'answer')
    throw new Usage('Use walkthrough sample or walkthrough answer long|short.');
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
  for (const commit of sampleWalkthroughCommits) {
    await mkdir(join(session.repository, dirname(commit.path)), {
      recursive: true,
    });
    await session.writeFile(commit.path, commit.text);
    await session.git('add', commit.path);
    await session.git('commit', '-m', commit.message);
  }
  const content = sampleContent();
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
        caption: 'The search results without a count',
        bytes: fixtureScreenshot([37, 99, 235]),
      },
      {
        id: 'sample-screen-2',
        mediaType: 'image/png',
        caption: 'The search results with “3 notes found”',
        bytes: fixtureScreenshot([220, 38, 38]),
      },
    ],
    {
      state: 'FAILURE',
      checksTruncated: false,
      results: fixtureCheckResults,
    },
  );
  return `wrote walkthrough ${run.id} for pull request #423: a call on each step, diagrams on both steps, checks and two screenshots on step 2\n`;
}
