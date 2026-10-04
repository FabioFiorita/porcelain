import { describe, expect, it } from 'vitest';
import {
  childFilePath,
  fileReadError,
  matchingFilePaths,
} from './navigation.ts';

describe('file navigation', () => {
  it('finds paths by case-insensitive substring without changing their spelling or order', () => {
    expect(
      matchingFilePaths(
        ['src/Index.ts', 'notes/a #&?.md', 'src/index.test.ts'],
        ' INDEX ',
      ),
    ).toEqual(['src/Index.ts', 'src/index.test.ts']);
    expect(matchingFilePaths(['notes/a #&?.md'], '#&?')).toEqual([
      'notes/a #&?.md',
    ]);
    expect(matchingFilePaths(['README.md'], 'missing')).toEqual([]);
  });

  it('keeps root and nested names as literal worktree-relative paths', () => {
    expect(childFilePath('', 'README.md')).toBe('README.md');
    expect(childFilePath('notes', 'a #&?.md')).toBe('notes/a #&?.md');
  });

  it('preserves server and connection errors and explains an unknown failure', () => {
    expect(fileReadError(new Error('Worktree not found'))).toBe(
      'Worktree not found',
    );
    expect(fileReadError(undefined)).toBe(
      'This file could not be loaded. Try again.',
    );
  });
});
