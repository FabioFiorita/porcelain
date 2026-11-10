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

const app = (index: number, routes: { name: string }[]) => ({
  key: 'navigator:root',
  type: 'stack',
  index: 0,
  routes: [
    {
      name: '__root',
      state: { key: 'navigator:0', type: 'stack', index, routes },
    },
  ],
});

it('has no way out of a tab root', () => {
  expect(navigationExits(app(0, [tabs(['worktrees'])]))).toEqual({
    back: false,
    close: undefined,
  });
});

it('goes back from a screen pushed inside a tab', () => {
  expect(navigationExits(app(0, [tabs(['worktrees', 'file'])]))).toEqual({
    back: true,
    close: undefined,
  });
});

it('closes a presented sheet or Settings on the stack that holds the tabs', () => {
  expect(
    navigationExits(app(1, [tabs(['worktrees']), { name: '(settings)' }])),
  ).toEqual({ back: true, close: 'navigator:0' });
});

it('closes a sheet opened inside Settings before Settings itself', () => {
  const settings = (stack: string[]) => ({
    name: '(settings)',
    state: {
      key: 'navigator:settings',
      type: 'stack',
      index: stack.length - 1,
      routes: stack.map((name) => ({ name })),
    },
  });
  expect(
    navigationExits(
      app(1, [
        tabs(['worktrees']),
        settings(['settings', 'computers', 'pair-computer']),
      ]),
    ).close,
  ).toBe('navigator:settings');
  expect(
    navigationExits(
      app(1, [tabs(['worktrees']), settings(['settings', 'computers'])]),
    ).close,
  ).toBe('navigator:0');
});

it('is quiet before navigation is ready', () => {
  expect(navigationExits(undefined)).toEqual({ back: false, close: undefined });
  expect(navigationExits({ type: 'stack', index: 0 })).toEqual({
    back: false,
    close: undefined,
  });
});
