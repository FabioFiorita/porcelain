import { expect, it } from 'vite-plus/test';
import { startPath } from './start-path';

it.each([
  {
    state: 'none',
    path: '/worktrees',
    why: 'first launch lands on the selector',
  },
  {
    state: 'selected',
    path: '/walkthrough',
    why: 'a chosen worktree opens its Walkthrough',
  },
  {
    state: 'unavailable',
    path: '/walkthrough',
    why: 'an offline computer still opens the tabs, which explain it',
  },
  {
    state: 'failed',
    path: '/walkthrough',
    why: 'a failed read opens the tabs, which offer Read again',
  },
  {
    state: 'loading',
    path: undefined,
    why: 'nothing is decided before the selection is read',
  },
] as const)('$why', ({ state, path }) => {
  expect(startPath(state)).toBe(path);
});
