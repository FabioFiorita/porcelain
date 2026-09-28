import { describe, expect, it } from 'vitest';
import { statusFromChanges } from './status.ts';

describe('statusFromChanges', () => {
  it('keeps the Git state the user saw and every file with its fingerprint', () => {
    expect(
      statusFromChanges({
        environmentId: '00000000-0000-4000-8000-000000000000',
        worktreeId: 'w'.repeat(32),
        statusToken: 'token',
        headOid: 'b'.repeat(40),
        inProgress: 'merge',
        mergeHeadOid: 'c'.repeat(40),
        branch: { name: 'main', upstream: 'origin/main', ahead: 2, behind: 1 },
        changes: [
          {
            path: 'new.ts',
            fingerprint: 'print',
            comparisons: [{ scope: 'untracked', path: 'new.ts' }],
          },
          {
            path: 'conflict.ts',
            fingerprint: undefined,
            comparisons: [
              {
                scope: 'unmerged',
                path: 'conflict.ts',
                conflict: 'both-modified',
              },
            ],
          },
        ],
      }),
    ).toEqual({
      statusToken: 'token',
      inProgress: 'merge',
      mergeHeadOid: 'c'.repeat(40),
      headOid: 'b'.repeat(40),
      branch: { name: 'main', upstream: 'origin/main', ahead: 2, behind: 1 },
      changes: [
        { scope: 'untracked', path: 'new.ts' },
        { scope: 'unmerged', path: 'conflict.ts', conflict: 'both-modified' },
      ],
      files: [
        { path: 'new.ts', fingerprint: 'print' },
        { path: 'conflict.ts', fingerprint: undefined },
      ],
    });
  });
});
