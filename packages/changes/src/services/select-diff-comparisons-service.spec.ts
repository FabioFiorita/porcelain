import { describe, expect, it } from 'vitest';
import {
  SelectionMismatchError,
  WorktreeChangedError,
} from '@porcelain/changes/errors';
import type { ChangeStatusObservation } from '@porcelain/changes/models';
import { SelectDiffComparisonsService } from './select-diff-comparisons-service.ts';
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
const select = new SelectDiffComparisonsService();

describe('SelectDiffComparisonsService', () => {
  it('returns the listed comparisons for the selections and the paths they cover', () => {
    expect(
      select.execute({
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
      comparisons: [modified('unstaged', 'a.md'), renamed],
      paths: ['a.md', 'GUIDE.md'],
    });
  });

  it('refuses a selection whose file was not stated', () => {
    expect(() =>
      select.execute({
        status,
        expectedFiles: [{ path: 'a.md', fingerprint: undefined }],
        selections: [
          { scope: 'staged', oldPath: 'other.md', newPath: 'other.md' },
        ],
      }),
    ).toThrow(SelectionMismatchError);
  });

  it('refuses a stated file that no selection covers', () => {
    expect(() =>
      select.execute({
        status,
        expectedFiles: [
          { path: 'a.md', fingerprint: undefined },
          { path: 'GUIDE.md', fingerprint: undefined },
        ],
        selections: [{ scope: 'unstaged', oldPath: 'a.md', newPath: 'a.md' }],
      }),
    ).toThrow(SelectionMismatchError);
  });

  it('refuses a file stated twice', () => {
    expect(() =>
      select.execute({
        status,
        expectedFiles: [
          { path: 'a.md', fingerprint: undefined },
          { path: 'a.md', fingerprint: 'f'.repeat(64) },
        ],
        selections: [{ scope: 'unstaged', oldPath: 'a.md', newPath: 'a.md' }],
      }),
    ).toThrow(SelectionMismatchError);
  });

  it('reports a moved worktree when a stated selection is no longer listed', () => {
    expect(() =>
      select.execute({
        status,
        expectedFiles: [{ path: 'a.md', fingerprint: undefined }],
        selections: [{ scope: 'staged', oldPath: 'a.md', newPath: 'a.md' }],
      }),
    ).toThrow(WorktreeChangedError);
  });
});
