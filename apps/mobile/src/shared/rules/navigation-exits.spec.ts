import { expect, it } from 'vitest';
import { navigationExits } from './navigation-exits';

const tabs = (stack: string[]) => ({
  name: '(tabs)',
  state: {
    type: 'tab',
    index: 1,
    routes: [
      { name: '(reviews)' },
      {
        name: '(worktrees)',
        state: {
          type: 'stack',
          index: stack.length - 1,
          routes: stack.map((name) => ({ name })),
        },
      },
    ],
  },
});

it('has no way out of a tab root', () => {
  expect(
    navigationExits({ type: 'stack', index: 0, routes: [tabs(['worktrees'])] }),
  ).toEqual({ back: false, close: false });
});

it('goes back from a screen pushed inside a tab', () => {
  expect(
    navigationExits({
      type: 'stack',
      index: 0,
      routes: [tabs(['worktrees', 'file'])],
    }),
  ).toEqual({ back: true, close: false });
});

it('goes back and closes when a sheet or Settings is presented', () => {
  expect(
    navigationExits({
      type: 'stack',
      index: 1,
      routes: [tabs(['worktrees']), { name: '(settings)' }],
    }),
  ).toEqual({ back: true, close: true });
});

it('is quiet before navigation is ready', () => {
  expect(navigationExits(undefined)).toEqual({ back: false, close: false });
  expect(navigationExits({ type: 'stack', index: 0 })).toEqual({
    back: false,
    close: false,
  });
});
