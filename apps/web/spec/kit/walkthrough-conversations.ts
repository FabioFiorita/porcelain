import {
  scriptedWalkthroughs,
  seedStoredWalkthroughs,
} from '@porcelain/server/kit/walkthrough-fixture';
import { serverReaders } from './readers.ts';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReadWalkthroughResult as WalkthroughRun } from '@porcelain/contracts/walkthroughs';
type WalkthroughContent = Extract<
  WalkthroughRun['state'],
  { status: 'ready' }
>['content'];
import type { World } from './world.ts';

export async function walkthroughConversationsFixture(
  world: World,
  action:
    | 'pr'
    | 'no-pr'
    | 'fail'
    | 'recover'
    | 'moved'
    | 'posts'
    | 'short-pr'
    | 'short-copy'
    | 'changed-pr'
    | 'running-update'
    | 'failed-update'
    | 'two-branches',
): Promise<string> {
  const server = world.server;
  const project = await serverReaders({
    read: (request) => world.read({ ...request, server: 'this' }),
    hits: () => world.hits('this'),
  }).project();
  const worktree = project.worktrees[0];
  if (!worktree) throw new Error('The conversation fixture needs a worktree.');
  const session = server.session(world.recorder, {
    projectId: project.id,
    worktreeId: worktree.id,
  });
  const failure = join(session.projectHome, 'conversation-failure');
  const calls = join(session.projectHome, 'conversation-posts');
  if (action === 'fail') {
    await writeFile(failure, 'fail');
    return '';
  }
  if (action === 'recover') {
    await rm(failure);
    return '';
  }
  if (action === 'moved') {
    await session.git(
      'remote',
      'set-url',
      'origin',
      'https://github.com/example/elsewhere.git',
    );
    return '';
  }
  if (action === 'posts') return readFile(calls, 'utf8');
  await session.git(
    'remote',
    'add',
    'origin',
    'https://github.com/example/sample.git',
  );
  await session.git('branch', 'walkthrough-conversation-base');
  await session.writeFile(
    'walkthrough-fixture.txt',
    'A conversation fixture.\n',
  );
  await session.git('add', 'walkthrough-fixture.txt');
  await session.git('commit', '-m', 'Prepare walkthrough conversations');
  const writer = await scriptedWalkthroughs(session, server.manifestPath, {
    answer:
      'Keep the retry beside its owner. The `local` boundary is deliberate.',
    costUsd: 0.01,
    failurePath: failure,
    postsPath: calls,
  });
  const stop = (
    title: string,
    call: boolean,
  ): WalkthroughContent['stops'][number] => ({
    title,
    explanation: 'Keep the behavior close to its owner.',
    excerpts: [],
    evidence: [],
    files: call
      ? [{ path: 'walkthrough-fixture.txt', note: 'Owns the behavior' }]
      : [],
    ...(call
      ? {
          attention: {
            kind: 'product',
            question: 'Keep retries local?',
            note: 'The owner chooses the boundary.',
          },
        }
      : {}),
  });
  const content: WalkthroughContent = {
    outcome: 'needs_you',
    title: 'Keep retries beside their owner',
    summary: 'Two decisions to discuss.',
    growth: [],
    stops: [stop('Retry boundary', true), stop('Failure handling', false)],
    onlyInTranscript: [],
    stillUnclear: [],
  };
  const base = 'refs/heads/walkthrough-conversation-base';
  const hasPr = action !== 'no-pr';
  const run = await writer.write(content, {
    base,
    ...(hasPr ? { pullRequestNumber: 423 } : {}),
  });
  if (action === 'two-branches') {
    const branchA = (await session.git('branch', '--show-current')).trim();
    await writer.comment(run.id, 'Retry boundary', 'Only branch A', 'saved');
    await session.git('checkout', '-b', 'conversation-branch-b');
    const b = await writer.write(
      { ...content, title: 'Decisions on branch B' },
      { base, pullRequestNumber: 424 },
    );
    await writer.comment(b.id, 'Retry boundary', 'Only branch B', 'saved');
    await session.git('checkout', branchA);
  }
  if (action === 'running-update' || action === 'failed-update') {
    await writer.reply('The original boundary still matters.');
    await writer.comment(
      run.id,
      'Retry boundary',
      'Keep the original boundary.',
      'saved',
    );
    await writer.reply(
      'Keep the retry beside its owner. The `local` boundary is deliberate.',
    );
    const state: WalkthroughRun['state'] =
      action === 'running-update'
        ? { status: 'running' }
        : {
            status: 'failed',
            failure: {
              kind: 'signed_out',
              message: 'The update writer stopped.',
            },
          };
    seedStoredWalkthroughs(
      join(session.projectHome, session.fixture.folders.state),
      {
        jobs: [
          {
            run: {
              ...run,
              id: 'update-attempt',
              writer: {
                provider: 'codex',
                model: 'gpt-6.1-sol',
                effort: 'high',
              },
              state,
            },
            worktreePath: session.repository,
            files: [],
          },
        ],
      },
    );
  }
  if (
    action === 'short-pr' ||
    action === 'short-copy' ||
    action === 'changed-pr'
  ) {
    await writer.reply('The original boundary still matters.');
    await writer.comment(
      run.id,
      'Retry boundary',
      'Keep the original boundary.',
      'saved',
    );
    await writer.comment(
      run.id,
      'Retry boundary',
      'This was already discussed.',
      'posted',
    );
    await session.git(
      'commit',
      '--allow-empty',
      '-m',
      'Advance the conversation fixture',
    );
    await writer.write(
      action === 'changed-pr'
        ? content
        : {
            ...content,
            outcome: 'nothing',
            title: 'A small routine change',
            summary: 'Nothing new needs a decision.',
            stops: [],
          },
      { base, ...(action === 'short-copy' ? {} : { pullRequestNumber: 424 }) },
    );
    await writer.reply(
      'Keep the retry beside its owner. The `local` boundary is deliberate.',
    );
    await writeFile(calls, '');
  }
  return run.id;
}
