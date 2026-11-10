import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import {
  ServerHandle,
  type Recorder,
} from '@porcelain/server/kit/isolated-server';
import {
  scriptedWalkthroughs,
  seedStoredWalkthroughs,
} from '@porcelain/server/kit/walkthrough-fixture';
import type { ReadWalkthroughResult } from '@porcelain/contracts/walkthroughs';
import { Usage } from '../../verify-core/cli.ts';

type Content = Extract<
  ReadWalkthroughResult['state'],
  { status: 'ready' }
>['content'];

const SHORT_ANSWER =
  'Keep the retry beside its owner. The `local` boundary is deliberate.';
const LONG_ANSWER = [
  'Keeping the retry beside its owner means the owner decides how often to try again, how long to wait between attempts and when to give up.',
  'Moving it to a shared helper would hide that choice from the reader and make every caller inherit the same timing, even the ones that should fail fast.',
  'The `local` boundary is deliberate: it keeps the decision where the behavior lives, and it is cheap to move later if a second owner ever needs the same policy.',
].join(' ');

const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of bytes) c = (table[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc(body), body.length + 4);
  return out;
}

function screenshot(accent: readonly [number, number, number]) {
  const width = 360;
  const height = 640;
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const card = y > 120 && y < 300 && x > 24 && x < width - 24;
      const bar = y < 64;
      const [r, g, b] = bar ? accent : card ? [236, 238, 242] : [250, 250, 250];
      rows.set([r, g, b], row + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Uint8Array.from(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(rows)),
      chunk('IEND', new Uint8Array()),
    ]),
  );
}

const stop = (
  title: string,
  path: string,
  call: boolean,
): Content['stops'][number] => ({
  title,
  explanation: 'Keep the behavior close to its owner, so a reader finds it.',
  excerpts: [],
  evidence: [],
  files: [{ path, note: 'Owns the behavior' }],
  ...(call
    ? {
        attention: {
          kind: 'product',
          question: 'Keep retries local to their owner?',
          note: 'Either choice ships; only the owner can pick the boundary.',
        },
      }
    : {}),
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
  const bin = String(JSON.parse(await readFile(manifest, 'utf8')).bin);
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
  await session.git('switch', '-C', 'walkthrough-sample');
  await session.writeFile('retry-owner.txt', 'The owner retries.\n');
  await session.writeFile('retry-notes.txt', 'Why the owner retries.\n');
  await session.git('add', 'retry-owner.txt', 'retry-notes.txt');
  await session.git('commit', '-m', 'Keep retries beside their owner');
  const content: Content = {
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
  const assets = [
    {
      runId: run.id,
      id: 'sample-screen-1',
      mediaType: 'image/png',
      caption: 'The retry setting on its owner',
      bytes: screenshot([37, 99, 235]),
    },
    {
      runId: run.id,
      id: 'sample-screen-2',
      mediaType: 'image/png',
      caption: 'The failure message after three tries',
      bytes: screenshot([220, 38, 38]),
    },
  ];
  seedStoredWalkthroughs(
    join(session.projectHome, session.fixture.folders.state),
    {
      jobs: [
        {
          run: {
            ...run,
            state: {
              ...run.state,
              content: {
                ...run.state.content,
                stops: run.state.content.stops.map((item, index) =>
                  index === 1
                    ? {
                        ...item,
                        evidence: assets.map((asset) => ({
                          assetId: asset.id,
                          shows: asset.caption,
                        })),
                      }
                    : item,
                ),
              },
            },
          },
          worktreePath: session.repository,
          files: [],
        },
      ],
      assets,
    },
  );
  return `wrote walkthrough ${run.id} for pull request #423 with two screenshots on step 2\n`;
}
