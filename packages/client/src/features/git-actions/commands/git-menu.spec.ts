import { Effect } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { expect, it } from 'vitest';
import type { GitNotice } from '../rules/index.ts';
import { runNetworkAction, type GitMenuControls } from './git-menu.ts';

it('refuses Pull with the computer’s settings reason before reading Git or running anything', async () => {
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
        'Choose Reviews & Git settings for this computer in Settings first.',
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
        'Choose Reviews & Git settings for this computer in Settings first.',
      type: 'error',
    },
  ]);
});
