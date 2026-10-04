import { describe, expect, it } from 'vitest';
import { branchRange, branchFilePaths } from './branch.ts';

const branch: Parameters<typeof branchRange>[0] = {
  worktreeId: 'tree',
  head: { oid: 'head', branch: 'refs/heads/topic' },
  base: { ref: 'refs/heads/main', oid: 'base-tip' },
  mergeBaseOid: 'fork',
  commits: 1,
  files: [],
};

describe('branch diff selection', () => {
  it('compares from the merge base, and has no diff range without it', () => {
    expect(branchRange(branch)).toEqual({ baseOid: 'fork', headOid: 'head' });
    expect(
      branchRange({ ...branch, base: undefined, mergeBaseOid: undefined }),
    ).toBeNull();
  });
  it('includes both rename paths once, and keeps deletion paths', () => {
    const file: Parameters<typeof branchFilePaths>[0] = {
      path: 'new.ts',
      oldPath: 'old.ts',
      newPath: 'new.ts',
      status: 'renamed',
      oldMode: '100644',
      newMode: '100644',
      fingerprint: 'file',
    };
    expect(branchFilePaths(file)).toEqual(['old.ts', 'new.ts']);
    expect(branchFilePaths({ ...file, oldPath: 'new.ts' })).toEqual(['new.ts']);
    expect(
      branchFilePaths({ ...file, newPath: undefined, status: 'deleted' }),
    ).toEqual(['old.ts']);
  });
});
