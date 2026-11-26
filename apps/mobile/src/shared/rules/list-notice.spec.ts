import { expect, test } from 'vite-plus/test';
import { worktreeListNoticeComputer } from './list-notice';

const computers = [{ environmentId: 'desk' }, { environmentId: 'laptop' }];

test('the Worktrees selector explains the selected computer being away', () => {
  expect(worktreeListNoticeComputer({ selected: 'laptop', computers })).toEqual(
    { environmentId: 'laptop' },
  );
});

test('with nothing selected the selector explains the first computer', () => {
  expect(
    worktreeListNoticeComputer({ selected: undefined, computers }),
  ).toEqual({ environmentId: 'desk' });
});

test('with no computers there is no notice', () => {
  expect(
    worktreeListNoticeComputer({ selected: 'laptop', computers: [] }),
  ).toBeUndefined();
});
