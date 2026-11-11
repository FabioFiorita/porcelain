import { expect, it } from 'vitest';
import { Exit } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { StartWalkthroughRequest } from '@porcelain/contracts/walkthroughs';
import { walkthroughStartBinding } from './start-walkthrough.ts';

it('sends the displayed PR when retrying with a loading or failed pull request list', () => {
  const requests: StartWalkthroughRequest[] = [];
  for (const pulls of [
    AsyncResult.initial(true),
    AsyncResult.fail('offline'),
  ]) {
    const command = walkthroughStartBinding(
      [
        AsyncResult.initial(),
        async (request) => {
          requests.push(request);
          return Exit.succeed(undefined);
        },
      ],
      { pulls, branch: 'feature', displayedRun: { pullRequestNumber: 423 } },
    );
    command.start();
  }
  expect(requests).toEqual([
    { pullRequestNumber: 423 },
    { pullRequestNumber: 423 },
  ]);
});
