import { describe, expect, it } from 'vitest';
import type { ChangeStatusObservation } from '@porcelain/changes/models';
import {
  diffSelectionProblem,
  matchDiffSelections,
} from './match-diff-selections.ts';
import { modified } from '../../spec/fixtures/comparisons.ts';

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

describe('diffSelectionProblem and matchDiffSelections', () => {
  it('returns the listed comparisons for the selections and the paths they cover', () => {
    const input = {
      status,
      expectedFiles: [
        { path: 'a.md', fingerprint: undefined },
        { path: 'GUIDE.md', fingerprint: undefined },
      ],
      selections: [
        { scope: 'unstaged' as const, oldPath: 'a.md', newPath: 'a.md' },
        { scope: 'staged' as const, oldPath: 'README.md', newPath: 'GUIDE.md' },
      ],
    };
    expect(diffSelectionProblem(input)).toBeUndefined();
    expect(matchDiffSelections(input)).toEqual({
      comparisons: [modified('unstaged', 'a.md'), renamed],
      paths: ['a.md', 'GUIDE.md'],
    });
  });

  it('refuses a selection that names neither an old nor a new path', () => {
    expect(
      diffSelectionProblem({
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
      diffSelectionProblem({
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
      diffSelectionProblem({
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
      diffSelectionProblem({
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
      diffSelectionProblem({
        status,
        expectedFiles: [{ path: 'a.md', fingerprint: undefined }],
        selections: [{ scope: 'staged', oldPath: 'a.md', newPath: 'a.md' }],
      }),
    ).toEqual({ kind: 'worktree-changed' });
  });
});
