import { describe, expect, it } from 'vitest';
import {
  SelectionMismatchError,
  UnnamedDiffSelectionError,
} from '@porcelain/changes/errors';
import type { ChangeStatusObservation } from '@porcelain/changes/models';
import { WorktreeChangedError } from '@porcelain/kernel/errors';
import { modified } from '../../spec/fixtures/comparisons.ts';
import { CheckDiffSelectionService } from './check-diff-selection-service.ts';

const status: ChangeStatusObservation = {
  statusToken: 't'.repeat(64),
  headOid: undefined,
  inProgress: undefined,
  mergeHeadOid: undefined,
  branch: undefined,
  changes: [modified('unstaged', 'a.md')],
};
const stated = [{ path: 'a.md', fingerprint: undefined }];
const service = new CheckDiffSelectionService();

describe('CheckDiffSelectionService', () => {
  it('answers the listed comparisons and paths of a matching selection', () => {
    expect(
      service.execute({
        status,
        expectedFiles: stated,
        selections: [{ scope: 'unstaged', oldPath: 'a.md', newPath: 'a.md' }],
      }),
    ).toEqual({ comparisons: [modified('unstaged', 'a.md')], paths: ['a.md'] });
  });

  it('refuses a selection that names no path', () => {
    expect(() =>
      service.execute({
        status,
        expectedFiles: stated,
        selections: [
          { scope: 'unstaged', oldPath: undefined, newPath: undefined },
        ],
      }),
    ).toThrow(UnnamedDiffSelectionError);
  });

  it('refuses a selection of a file that was not stated', () => {
    expect(() =>
      service.execute({
        status,
        expectedFiles: stated,
        selections: [
          { scope: 'staged', oldPath: 'other.md', newPath: 'other.md' },
        ],
      }),
    ).toThrow(SelectionMismatchError);
  });

  it('reports a changed worktree when a stated selection is no longer listed', () => {
    expect(() =>
      service.execute({
        status,
        expectedFiles: stated,
        selections: [{ scope: 'staged', oldPath: 'a.md', newPath: 'a.md' }],
      }),
    ).toThrow(WorktreeChangedError);
  });
});
