import type { TrackedComparison } from '@porcelain/kernel/models';
import { describe, expect, it } from 'vitest';
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
  it('names a deleted file by its old path', () => {
    expect(trackedPath({ oldPath: 'gone.md' })).toBe('gone.md');
  });
});

describe('logicalPath', () => {
  it('names a tracked comparison by its new path, then its old path', () => {
    expect(logicalPath(tracked('old.md', 'new.md'))).toBe('new.md');
    expect(logicalPath(tracked('gone.md', undefined))).toBe('gone.md');
  });
});
