import { describe, expect, it } from 'vitest';
import type { ChangeStatusObservation } from '@porcelain/changes/models';
import { diffComparisons } from './diff-comparisons.ts';
import { modified } from '../../spec/fakes/comparisons.ts';

const renamed = {
  ...modified('staged', 'GUIDE.md', '1'.repeat(40)),
  kind: 'renamed' as const,
  oldPath: 'README.md',
};
const status: ChangeStatusObservation = {
  statusToken: 't'.repeat(64),
  headOid: undefined,
  inProgress: undefined,
  mergeHeadOid: undefined,
  branch: undefined,
  changes: [
    modified('unstaged', 'a.md'),
    renamed,
    { scope: 'untracked', path: 'notes.txt' },
  ],
};

describe('diffComparisons', () => {
  it('returns the listed comparisons for the selections and the paths they cover', () => {
    expect(
      diffComparisons({
        status,
        expectedFiles: [
          { path: 'a.md', fingerprint: undefined },
          { path: 'GUIDE.md', fingerprint: undefined },
        ],
        selections: [
          { scope: 'unstaged', oldPath: 'a.md', newPath: 'a.md' },
          { scope: 'staged', oldPath: 'README.md', newPath: 'GUIDE.md' },
        ],
      }),
    ).toEqual({
      kind: 'selected',
      comparisons: [modified('unstaged', 'a.md'), renamed],
      paths: ['a.md', 'GUIDE.md'],
    });
  });

  it('refuses a selection that names neither an old nor a new path', () => {
    expect(
      diffComparisons({
        status,
        expectedFiles: [{ path: 'a.md', fingerprint: undefined }],
        selections: [
          { scope: 'unstaged', oldPath: undefined, newPath: undefined },
        ],
      }),
    ).toEqual({ kind: 'unnamed-selection' });
  });

  it('refuses a selection whose file was not stated', () => {
    expect(
      diffComparisons({
        status,
        expectedFiles: [{ path: 'a.md', fingerprint: undefined }],
        selections: [
          { scope: 'staged', oldPath: 'other.md', newPath: 'other.md' },
        ],
      }),
    ).toEqual({ kind: 'selection-mismatch' });
  });

  it('refuses a stated file that no selection covers', () => {
    expect(
      diffComparisons({
        status,
        expectedFiles: [
          { path: 'a.md', fingerprint: undefined },
          { path: 'GUIDE.md', fingerprint: undefined },
        ],
        selections: [{ scope: 'unstaged', oldPath: 'a.md', newPath: 'a.md' }],
      }),
    ).toEqual({ kind: 'selection-mismatch' });
  });

  it('refuses a file stated twice', () => {
    expect(
      diffComparisons({
        status,
        expectedFiles: [
          { path: 'a.md', fingerprint: undefined },
          { path: 'a.md', fingerprint: 'f'.repeat(64) },
        ],
        selections: [{ scope: 'unstaged', oldPath: 'a.md', newPath: 'a.md' }],
      }),
    ).toEqual({ kind: 'selection-mismatch' });
  });

  it('reports a moved worktree when a stated selection is no longer listed', () => {
    expect(
      diffComparisons({
        status,
        expectedFiles: [{ path: 'a.md', fingerprint: undefined }],
        selections: [{ scope: 'staged', oldPath: 'a.md', newPath: 'a.md' }],
      }),
    ).toEqual({ kind: 'worktree-changed' });
  });
});
