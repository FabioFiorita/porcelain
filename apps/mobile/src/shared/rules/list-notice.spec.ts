import { expect, test } from 'vite-plus/test';
import { worktreeListNoticeComputer } from './list-notice';

const computers = [{ environmentId: 'desk' }, { environmentId: 'laptop' }];

test('on a phone the Worktrees list explains the selected computer being away', () => {
  expect(
    worktreeListNoticeComputer({
      layout: 'stack',
      selected: 'laptop',
      computers,
    }),
  ).toEqual({ environmentId: 'laptop' });
  expect(
    worktreeListNoticeComputer({
      layout: 'stack',
      selected: undefined,
      computers,
    }),
  ).toEqual({ environmentId: 'desk' });
});

test('beside an open reader the list leaves the single notice to the reader', () => {
  expect(
    worktreeListNoticeComputer({
      layout: 'beside',
      selected: 'laptop',
      computers,
    }),
  ).toBeUndefined();
  expect(
    worktreeListNoticeComputer({
      layout: 'beside',
      selected: undefined,
      computers,
    }),
  ).toEqual({ environmentId: 'desk' });
});
