import { describe, expect, it } from 'vitest';
import type {
  ChangeComparison,
  TrackedComparison,
} from '@porcelain/kernel/models';
import { isTracked } from './is-tracked.ts';

const sides: Omit<TrackedComparison, 'scope'> = {
  kind: 'modified',
  oldPath: 'a.md',
  newPath: 'a.md',
  oldMode: '100644',
  newMode: '100644',
  oldOid: undefined,
  newOid: undefined,
  supported: true,
};

describe('isTracked', () => {
  it('counts staged and unstaged comparisons as tracked', () => {
    const comparisons: ChangeComparison[] = [
      { scope: 'staged', ...sides },
      { scope: 'unstaged', ...sides },
    ];
    expect(comparisons.map(isTracked)).toEqual([true, true]);
  });

  it('counts untracked and unmerged comparisons as not tracked', () => {
    const comparisons: ChangeComparison[] = [
      { scope: 'untracked', path: 'a.md' },
      {
        scope: 'unmerged',
        path: 'a.md',
        conflict: 'both-modified',
        modes: ['100644', '100644', '100644', '100644'],
        oids: ['a', 'b', 'c'],
      },
    ];
    expect(comparisons.map(isTracked)).toEqual([false, false]);
  });
});
