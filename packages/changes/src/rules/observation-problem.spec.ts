import { describe, expect, it } from 'vitest';
import { observationProblem } from './observation-problem.ts';
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

describe('observationProblem', () => {
  it('finds no problem in an observation that matches what the reviewer saw, including unfingerprinted files', () => {
    expect(observationProblem(input)).toBeUndefined();
  });

  it('reports a changed worktree when the status token differs', () => {
    expect(
      observationProblem({ ...input, statusToken: 'u'.repeat(64) }),
    ).toEqual({ kind: 'worktree-changed' });
  });

  it('reports a changed worktree when a fingerprint differs', () => {
    expect(
      observationProblem({
        ...input,
        expectedFiles: [{ path: 'a.md', fingerprint: 'e'.repeat(64) }],
      }),
    ).toEqual({ kind: 'worktree-changed' });
  });

  it('reports a changed worktree when a stated file lost its fingerprint', () => {
    expect(
      observationProblem({
        ...input,
        expectedFiles: [{ path: 'b.md', fingerprint }],
      }),
    ).toEqual({ kind: 'worktree-changed' });
  });

  it('reports a changed worktree when the files were touched since the earlier observation', () => {
    expect(observationProblem({ ...input, previousStamp: 'stamp-0' })).toEqual({
      kind: 'worktree-changed',
    });
  });

  it('finds no problem with an unchanged stamp on the second observation', () => {
    expect(
      observationProblem({ ...input, previousStamp: 'stamp-1' }),
    ).toBeUndefined();
  });
});
