import { describe, expect, it } from 'vitest';
import { commitDiffPath, showsWorktreeDiff } from './diff-eligibility.ts';

const file: Parameters<typeof commitDiffPath>[0] = {
  oldPath: 'before.ts',
  newPath: 'after.ts',
  status: 'renamed',
  oldMode: '100644',
  newMode: '100644',
};

describe('change diff eligibility', () => {
  it('shows text and metadata patches but leaves binary and omitted content out', () => {
    expect(showsWorktreeDiff({ kind: 'text', patch: 'patch' })).toBe(true);
    expect(showsWorktreeDiff({ kind: 'metadata-only', patch: 'patch' })).toBe(
      true,
    );
    expect(showsWorktreeDiff({ kind: 'binary' })).toBe(false);
    expect(showsWorktreeDiff({ kind: 'omitted', reason: 'size-limit' })).toBe(
      false,
    );
  });

  it('uses the new path for a renamed commit file and the old path for a deletion', () => {
    expect(commitDiffPath(file, { kind: 'text', patch: 'patch' })).toBe(
      'after.ts',
    );
    expect(
      commitDiffPath(
        { ...file, newPath: undefined, status: 'deleted' },
        { kind: 'text', patch: 'patch' },
      ),
    ).toBe('before.ts');
  });

  it('omits submodules, unreadable content and files without a path', () => {
    expect(
      commitDiffPath(
        { ...file, oldMode: '160000' },
        { kind: 'text', patch: 'patch' },
      ),
    ).toBeNull();
    expect(commitDiffPath(file, { kind: 'binary' })).toBeNull();
    expect(
      commitDiffPath(
        { ...file, oldPath: undefined, newPath: undefined },
        { kind: 'text', patch: 'patch' },
      ),
    ).toBeNull();
  });
});
