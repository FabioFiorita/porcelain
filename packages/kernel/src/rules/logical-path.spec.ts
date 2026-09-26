import { describe, expect, it } from 'vitest';
import type { TrackedComparison } from '@porcelain/kernel/models';
import { logicalPath, trackedPath } from './logical-path.ts';

function tracked(
  oldPath: string | undefined,
  newPath: string | undefined,
): TrackedComparison {
  return {
    scope: 'staged',
    kind: 'renamed',
    oldPath,
    newPath,
    oldMode: '100644',
    newMode: '100644',
    oldOid: undefined,
    newOid: undefined,
    supported: true,
  };
}

describe('trackedPath', () => {
  it('names a renamed file by its new path', () => {
    expect(trackedPath({ oldPath: 'old.md', newPath: 'new.md' })).toBe(
      'new.md',
    );
  });

  it('names a deleted file by its old path', () => {
    expect(trackedPath({ oldPath: 'gone.md' })).toBe('gone.md');
  });

  it('names nothing when neither side has a path', () => {
    expect(trackedPath({})).toBeUndefined();
  });
});

describe('logicalPath', () => {
  it('names a tracked comparison by its new path, then its old path', () => {
    expect(logicalPath(tracked('old.md', 'new.md'))).toBe('new.md');
    expect(logicalPath(tracked('gone.md', undefined))).toBe('gone.md');
  });

  it('names an untracked or unmerged comparison by its path', () => {
    expect(logicalPath({ scope: 'untracked', path: 'draft.md' })).toBe(
      'draft.md',
    );
    expect(
      logicalPath({
        scope: 'unmerged',
        path: 'both.md',
        conflict: 'both-modified',
        modes: ['100644', '100644', '100644', '100644'],
        oids: ['a', 'b', 'c'],
      }),
    ).toBe('both.md');
  });
});
