import { describe, expect, it } from 'vitest';
import {
  primaryGitAction,
  statusFromChanges,
  suggestedCount,
} from './status.ts';

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

describe('primaryGitAction', () => {
  const clean = {
    statusToken: 'token',
    changes: [],
    branch: { name: 'main', upstream: 'origin/main', ahead: 0, behind: 0 },
  };
  const stash = { oid: 'a'.repeat(40), message: 'On main: wip' };

  it('suggests pulling a branch that is behind, with how far behind it is', () => {
    const status = {
      ...clean,
      branch: { ...clean.branch, behind: 2, ahead: 1 },
    };
    const primary = primaryGitAction(status);
    expect(primary).toEqual({ kind: 'run', action: 'pull', label: 'Pull' });
    expect(suggestedCount(primary, status)).toBe(2);
  });

  it('suggests pushing a branch that is only ahead, with how far ahead it is', () => {
    const status = { ...clean, branch: { ...clean.branch, ahead: 3 } };
    const primary = primaryGitAction(status);
    expect(primary).toEqual({ kind: 'run', action: 'push', label: 'Push' });
    expect(suggestedCount(primary, status)).toBe(3);
  });

  it('suggests applying a waiting stash once nothing is left to commit, pull or push', () => {
    expect(
      primaryGitAction({
        ...clean,
        branch: { ...clean.branch, stashes: [stash] },
      }),
    ).toEqual({ kind: 'stash', label: 'Apply stash' });
  });

  it('suggests committing before applying a waiting stash', () => {
    expect(
      primaryGitAction({
        ...clean,
        changes: [{ scope: 'untracked', path: 'new.ts' }],
        branch: { ...clean.branch, stashes: [stash] },
      }).kind,
    ).toBe('commit');
  });

  it('suggests nothing when there is nothing to commit, pull, push or apply', () => {
    const primary = primaryGitAction({
      ...clean,
      branch: { ...clean.branch, stashes: [] },
    });
    expect(primary.kind).toBe('hint');
    expect(suggestedCount(primary, clean)).toBeNull();
  });
});
