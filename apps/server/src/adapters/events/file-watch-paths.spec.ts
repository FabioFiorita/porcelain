import { expect, it } from 'vitest';
import { fileWatchPaths } from './file-watch-paths.ts';

it('ignores a batch containing only temporary writes instead of invalidating every file', () => {
  expect(
    fileWatchPaths(
      '/repo',
      [{ path: '/repo/.temporary' }],
      (path) => path === '.temporary',
    ),
  ).toBeUndefined();
});

it('ignores empty batches, the root and paths outside the watched worktree', () => {
  expect(fileWatchPaths('/repo', [], () => false)).toBeUndefined();
  expect(
    fileWatchPaths(
      '/repo',
      [{ path: '/repo' }, { path: '/other/file' }],
      () => false,
    ),
  ).toBeUndefined();
});

it('announces real paths even when their batch also contains temporary writes', () => {
  expect(
    fileWatchPaths(
      '/repo',
      [{ path: '/repo/.temporary' }, { path: '/repo/src/file.ts' }],
      (path) => path === '.temporary',
    ),
  ).toEqual(['src/file.ts']);
});
