import { expect, it } from 'vitest';
import { Exit } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { StartWalkthroughRequest } from '@porcelain/contracts/walkthroughs';
import { walkthroughStartBinding } from './start-walkthrough.ts';

const loaded = {
  kind: 'available' as const,
  account: 'fixture',
  pullRequests: [
    {
      number: 8,
      headBranch: 'feature',
      state: 'open' as const,
      title: 'Change',
      url: 'https://github.com/fixture/project/pull/8',
      draft: false,
      baseBranch: 'main',
      updatedAt: '2026-11-10T00:00:00Z',
      checksTruncated: false,
    },
  ],
  truncated: false,
  recentlyClosedSince: '2026-11-01T00:00:00Z',
};

it.each([
  {
    label: 'displayed run and failed list',
    pulls: AsyncResult.fail('offline'),
    displayedRun: { pullRequestNumber: 423 },
    expected: { pullRequestNumber: 423 },
  },
  {
    label: 'displayed run and loaded list naming another PR',
    pulls: AsyncResult.success(loaded),
    displayedRun: { pullRequestNumber: 423 },
    expected: { pullRequestNumber: 423 },
  },
  {
    label: 'no run and loaded list refreshing',
    pulls: AsyncResult.success(loaded, { waiting: true }),
    displayedRun: undefined,
    expected: { pullRequestNumber: 8 },
  },
  {
    label: 'no run and never loaded list',
    pulls: AsyncResult.initial(true),
    displayedRun: undefined,
    expected: {},
  },
])('sends the request for $label', ({ pulls, displayedRun, expected }) => {
  const requests: StartWalkthroughRequest[] = [];
  const command = walkthroughStartBinding(
    [
      AsyncResult.initial(),
      async (request) => {
        requests.push(request);
        return Exit.succeed(undefined);
      },
    ],
    { pulls, branch: 'feature', displayedRun },
  );
  command.start();
  expect(requests).toEqual([expected]);
});
