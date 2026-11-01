import { Effect } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { expect, it } from 'vitest';
import type { GitNotice } from '../rules/index.ts';
import { runNetworkAction, type GitMenuControls } from './git-menu.ts';

it('refuses Pull when the computer’s settings cannot be read before reading Git or running anything', async () => {
  const notices: GitNotice[] = [];
  const calls: string[] = [];
  const menu: GitMenuControls = {
    details: {
      result: AsyncResult.initial(),
      read: () =>
        Effect.sync(() => {
          calls.push('read');
          throw new Error('Pull must not read Git status');
        }),
    },
    enableDetails: () => calls.push('enable'),
    pull: {
      kind: 'blocked',
      reason:
        'Reviews & Git settings could not be read. The computer is offline.',
    },
    notify: (notice) => notices.push(notice),
    onProgress: () => calls.push('progress'),
    onResult: (notice) => notices.push(notice),
  };

  await Effect.runPromise(
    runNetworkAction(
      menu,
      {
        run: () =>
          Effect.sync(() => {
            calls.push('run');
            throw new Error('Pull must not run');
          }),
      },
      'pull',
      undefined,
    ),
  );

  expect(calls).toEqual([]);
  expect(notices).toEqual([
    {
      title: 'Pull did not run',
      description:
        'Reviews & Git settings could not be read. The computer is offline.',
      type: 'error',
    },
  ]);
});
