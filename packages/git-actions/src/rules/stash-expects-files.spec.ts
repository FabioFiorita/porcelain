import { describe, expect, it } from 'vitest';
import { stashExpectsFiles } from './stash-expects-files.ts';

const stashOid = 'd'.repeat(40);

describe('stashExpectsFiles', () => {
  it('refuses every stash action that states no expected files', () => {
    for (const intent of [
      {
        action: 'stash-create' as const,
        message: 'Park',
        includeUntracked: true,
      },
      { action: 'stash-apply' as const, stashOid, restoreIndex: false },
      { action: 'stash-pop' as const, stashOid, restoreIndex: true },
    ])
      expect(stashExpectsFiles(intent, {})).toBe(false);
  });

  it('accepts a stash that expects a clean worktree', () => {
    expect(
      stashExpectsFiles(
        { action: 'stash-pop', stashOid, restoreIndex: false },
        { files: [] },
      ),
    ).toBe(true);
  });

  it('leaves other actions alone', () => {
    expect(
      stashExpectsFiles({ action: 'switch-branch', branch: 'main' }, {}),
    ).toBe(true);
  });
});
