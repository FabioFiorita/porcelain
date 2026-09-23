import { describe, expect, it } from 'vitest';
import { WorktreeChangedError } from '@porcelain/changes/errors';
import { ConfirmDiffObservationService } from './confirm-diff-observation-service.ts';
import { fileChange, modified } from '../../spec/fakes/comparisons.ts';

const token = 't'.repeat(64);
const fingerprint = 'f'.repeat(64);
const observation = {
  changes: [
    fileChange('a.md', [modified('unstaged', 'a.md')], fingerprint),
    fileChange('b.md', [modified('unstaged', 'b.md')]),
  ],
  stamp: 'stamp-1',
};
const confirm = new ConfirmDiffObservationService();
const input = {
  expectedStatusToken: token,
  expectedFiles: [
    { path: 'a.md', fingerprint },
    { path: 'b.md', fingerprint: undefined },
  ],
  statusToken: token,
  fingerprints: observation,
  previousStamp: undefined,
};

describe('ConfirmDiffObservationService', () => {
  it('accepts an observation that matches what the reviewer saw, including unfingerprinted files', () => {
    expect(() => confirm.execute(input)).not.toThrow();
  });

  it('reports a moved worktree when the status token differs', () => {
    expect(() =>
      confirm.execute({ ...input, statusToken: 'u'.repeat(64) }),
    ).toThrow(WorktreeChangedError);
  });

  it('reports a moved worktree when a fingerprint differs', () => {
    expect(() =>
      confirm.execute({
        ...input,
        expectedFiles: [{ path: 'a.md', fingerprint: 'e'.repeat(64) }],
      }),
    ).toThrow(WorktreeChangedError);
  });

  it('reports a moved worktree when a stated file lost its fingerprint', () => {
    expect(() =>
      confirm.execute({
        ...input,
        expectedFiles: [{ path: 'b.md', fingerprint }],
      }),
    ).toThrow(WorktreeChangedError);
  });

  it('reports a moved worktree when the files were touched since the earlier observation', () => {
    expect(() =>
      confirm.execute({ ...input, previousStamp: 'stamp-0' }),
    ).toThrow(WorktreeChangedError);
  });

  it('accepts an unchanged stamp on the second observation', () => {
    expect(() =>
      confirm.execute({ ...input, previousStamp: 'stamp-1' }),
    ).not.toThrow();
  });
});
