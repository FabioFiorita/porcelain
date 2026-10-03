import { describe, expect, it } from 'vitest';
import { changeId } from './change-id.ts';

type OrdinaryChange = Extract<Parameters<typeof changeId>[0], { kind: string }>;

const modified: OrdinaryChange = {
  scope: 'unstaged',
  kind: 'modified',
  oldPath: 'src/old.ts',
  newPath: 'src/current.ts',
  oldMode: '100644',
  newMode: '100644',
  oldOid: undefined,
  newOid: undefined,
  supported: true,
};

describe('changeId', () => {
  it('keeps a stable key for the same scope and displayed path as content changes', () => {
    expect(changeId(modified)).toBe('change:unstaged:src/current.ts');
    expect(changeId({ ...modified, oldOid: 'a'.repeat(40) })).toBe(
      changeId(modified),
    );
  });

  it('keeps staged and unstaged changes at the same path distinct', () => {
    expect(changeId({ ...modified, scope: 'staged' })).toBe(
      'change:staged:src/current.ts',
    );
  });

  it('uses the old path when a renamed or deleted change has no new path', () => {
    expect(changeId({ ...modified, kind: 'deleted', newPath: undefined })).toBe(
      'change:unstaged:src/old.ts',
    );
  });

  it('uses the direct path for untracked and unmerged changes', () => {
    expect(changeId({ scope: 'untracked', path: 'new.ts' })).toBe(
      'change:untracked:new.ts',
    );
    expect(
      changeId({
        scope: 'unmerged',
        path: 'conflict.ts',
        conflict: 'both-modified',
      }),
    ).toBe('change:unmerged:conflict.ts');
  });
});
