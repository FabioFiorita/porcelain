import { Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import type { ListPullRequestsResponse } from '@porcelain/contracts/reviews';
import { ReadInventoryUseCasePort } from '../../ports/read-inventory-use-case-port.ts';
import { ListProjectPullRequestsUseCasePort } from '../../ports/list-project-pull-requests-use-case-port.ts';
import { QueueWalkthroughUseCasePort } from '../../ports/queue-walkthrough-use-case-port.ts';
import { PollAutomaticWalkthroughsUseCase } from './poll-automatic-walkthroughs.ts';
it('makes no GitHub read by default, catches up open PRs, skips closed and merged PRs and quietly accepts unavailable GitHub', async () => {
  let calls = 0;
  const queued: string[] = [];
  const inventory: ReadInventoryResponse = {
    environmentId: 'fixture',
    environment: { name: 'Fixture', custom: true },
    projects: [
      {
        id: 'project',
        name: 'Fixture',
        available: true,
        worktrees: [
          {
            id: 'worktree',
            path: '/fixture',
            main: false,
            branch: 'topic',
            available: true,
            status: undefined,
          },
        ],
      },
    ],
  };
  let available = true;
  const states = ['open', 'closed', 'merged'] as const;
  const pulls = states.map((state, index) => ({
    number: index + 1,
    title: state,
    url: `https://github.com/fixture/project/pull/${index + 1}`,
    state,
    draft: false,
    headBranch: 'topic',
    baseBranch: 'release/fixture',
    updatedAt: '2026-11-09T00:00:00.000Z',
    checksTruncated: false,
  }));
  const layer = PollAutomaticWalkthroughsUseCase.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ReadInventoryUseCasePort, {
          execute: () => Effect.succeed(inventory),
        }),
        Layer.succeed(ListProjectPullRequestsUseCasePort, {
          execute: () => {
            calls++;
            return Effect.succeed(
              available
                ? ({
                    kind: 'available',
                    account: 'fixture',
                    pullRequests: pulls,
                    truncated: false,
                    recentlyClosedSince: '',
                  } satisfies ListPullRequestsResponse)
                : { kind: 'unavailable', reason: 'gh-not-installed' },
            );
          },
        }),
        Layer.succeed(QueueWalkthroughUseCasePort, {
          execute: (input) => {
            queued.push(input.automaticKey ?? 'missing');
            return Effect.succeed({
              id: 'run',
              projectId: 'project',
              worktreeId: input.worktreeId,
              pullRequestNumber: input.pullRequestNumber,
              writer: input.writer ?? {
                provider: 'claude',
                model: 'claude-opus-5-5',
                effort: 'high',
              },
              headOid: 'head',
              baseOid: 'base',
              sessionId: undefined,
              createdAt: '',
              state: { status: 'queued' as const },
            });
          },
        }),
      ),
    ),
  );
  const poll = Effect.gen(function* () {
    yield* (yield* PollAutomaticWalkthroughsUseCase).execute();
  }).pipe(Effect.provide(layer));
  await Effect.runPromise(poll);
  expect(calls).toBe(0);
  const project = inventory.projects[0];
  if (!project) throw new Error('Missing fixture project');
  Object.assign(project, {
    walkthroughSettings: {
      mode: 'automatic',
      writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'high' },
    },
  });
  await Effect.runPromise(poll);
  expect(queued).toEqual(['https://github.com/fixture/project/pull/1']);
  available = false;
  await Effect.runPromise(poll);
  expect(calls).toBe(2);
  expect(queued).toHaveLength(1);
});
