import { describe, expect, it } from 'vitest';
import { fileReviewStatus, addedFilePatch } from './files.ts';

describe('mobile review file comparisons', () => {
  it('only reports a matching fingerprint as reviewed', () => {
    const marks = {
      worktreeId: 'worktree',
      marks: [
        {
          path: 'a.ts',
          fingerprint: 'old',
          reviewedAt: '2026-01-01T00:00:00Z',
        },
      ],
    };
    expect(fileReviewStatus({ path: 'a.ts', fingerprint: 'old' }, marks)).toBe(
      'Reviewed',
    );
    expect(fileReviewStatus({ path: 'a.ts', fingerprint: 'new' }, marks)).toBe(
      'Changed since review',
    );
    expect(
      fileReviewStatus({ path: 'a.ts', fingerprint: undefined }, marks),
    ).toBe('Unreviewed');
    expect(fileReviewStatus({ path: 'b.ts', fingerprint: 'new' }, marks)).toBe(
      'Unreviewed',
    );
    expect(
      fileReviewStatus({ path: 'a.ts', fingerprint: 'old' }, undefined),
    ).toBe('Unreviewed');
  });
  it('shows every untracked text line as an addition while preserving whitespace and newline evidence', () => {
    expect(addedFilePatch('hello\n  next  \n')).toBe('+hello\n+  next  \n');
    expect(addedFilePatch('last')).toBe(
      '+last\n\\ No newline at end of file\n',
    );
    expect(addedFilePatch('')).toBe('');
  });
});
