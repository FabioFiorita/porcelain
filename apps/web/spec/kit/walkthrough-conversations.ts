import {
  scriptedWalkthroughs,
  seedStoredWalkthroughs,
} from '@porcelain/server/kit/walkthrough-fixture';
import { serverReaders } from './readers.ts';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReadWalkthroughResult as WalkthroughRun } from '@porcelain/contracts/walkthroughs';
type WalkthroughDraft = Extract<
  WalkthroughRun['state'],
  { status: 'ready' }
>['content'];
import type { World } from './world.ts';

type Worktrees = Awaited<
  ReturnType<ReturnType<typeof serverReaders>['project']>
>['worktrees'];

export async function worktreeSession(
  world: World,
  pick: (worktrees: Worktrees) => Worktrees[number] | undefined,
) {
  const project = await serverReaders({
    read: (request) => world.read({ ...request, server: 'this' }),
    hits: () => world.hits('this'),
  }).project();
  const worktree = pick(project.worktrees);
  if (!worktree) throw new Error('The walkthrough fixture needs a worktree.');
  return world.server.session(world.recorder, {
    projectId: project.id,
    worktreeId: worktree.id,
  });
}

export async function walkthroughConversationsFixture(
  world: World,
  action:
    | 'pr'
    | 'no-pr'
    | 'fail'
    | 'recover'
    | 'posts'
    | 'running-update'
    | 'failed-update'
    | 'other-worktree'
    | 'revision'
    | 'two-branches',
): Promise<string> {
  const server = world.server;
  const session = await worktreeSession(world, (worktrees) =>
    action === 'other-worktree'
      ? worktrees.find(({ branch }) => branch === 'other-draft-worktree')
      : worktrees[0],
  );
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
  if (action === 'posts') return readFile(calls, 'utf8');
  if (action !== 'other-worktree' && action !== 'revision') {
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
  }
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
  ): WalkthroughDraft['stops'][number] => ({
    title,
    explanation: 'Keep the behavior close to its owner.',
    blocks: call
      ? [
          {
            kind: 'files',
            files: [
              { path: 'walkthrough-fixture.txt', note: 'Owns the behavior' },
            ],
          },
          {
            kind: 'callout',
            attention: {
              kind: 'product',
              question: 'Keep retries local?',
              note: 'The owner chooses the boundary.',
            },
          },
        ]
      : [],
  });
  const content: WalkthroughDraft = {
    version: 1,
    outcome: 'needs_you',
    title: 'Keep retries beside their owner',
    summary: 'Two decisions to discuss.',
    growth: [],
    stops: [stop('Retry boundary', true), stop('Failure handling', false)],
    onlyInTranscript: [],
    stillUnclear: [],
  };
  const base = 'refs/heads/walkthrough-conversation-base';
  if (action === 'other-worktree' || action === 'revision') {
    return (
      await writer.write(
        {
          ...content,
          title:
            action === 'other-worktree'
              ? 'Questions on the other worktree'
              : 'The revised retry guidance',
        },
        { base },
      )
    ).id;
  }
  const hasPr = action !== 'no-pr';
  const run = await writer.write(content, {
    base,
    ...(hasPr ? { pullRequestNumber: 423 } : {}),
  });
  if (action === 'two-branches') {
    const branchA = (await session.git('branch', '--show-current')).trim();
    await writer.comment(run.id, 'Retry boundary', 'Only branch A');
    await session.git('checkout', '-b', 'conversation-branch-b');
    const b = await writer.write(
      { ...content, title: 'Decisions on branch B' },
      { base, pullRequestNumber: 424 },
    );
    await writer.comment(b.id, 'Retry boundary', 'Only branch B');
    await session.git('checkout', branchA);
  }
  if (action === 'running-update' || action === 'failed-update') {
    await writer.reply('The original boundary still matters.');
    await writer.comment(
      run.id,
      'Retry boundary',
      'Keep the original boundary.',
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
    const at = '2026-11-12T12:00:00.000Z';
    const progress: NonNullable<WalkthroughRun['progress']> = [
      {
        stage: 'writing',
        at,
        message: 'Codex is writing the updated walkthrough.',
      },
    ];
    seedStoredWalkthroughs(
      join(session.projectHome, session.fixture.folders.state),
      {
        jobs: [
          {
            run: {
              ...run,
              id: 'update-attempt',
              progress:
                state.status === 'failed'
                  ? [
                      ...progress,
                      { stage: 'failed', at, message: state.failure.message },
                    ]
                  : progress,
              writer: {
                provider: 'codex',
                model: 'gpt-6.1-sol',
                effort: 'high',
              },
              state,
            },
            worktreePath: session.repository,
            patch: '',
            files: [],
          },
        ],
      },
    );
  }
  return run.id;
}
