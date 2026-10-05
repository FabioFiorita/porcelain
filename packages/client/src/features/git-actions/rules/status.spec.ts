import { describe, expect, it } from 'vitest';
import {
  primaryGitAction,
  shownBranch,
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

describe('shownBranch', () => {
  const looked = {
    name: 'refs/heads/main',
    upstream: 'origin/main',
    ahead: 1,
    behind: 0,
    remoteName: 'origin',
    sourceRef: 'refs/heads/main',
    upstreamOid: undefined,
    stashes: [{ oid: 'a'.repeat(40), message: 'On main: wip' }],
    discarded: [],
  };

  it('counts ahead and behind from the live change list, not an older detailed read', () => {
    const branch = shownBranch(
      { name: 'refs/heads/main', upstream: 'origin/main', ahead: 0, behind: 3 },
      looked,
    );
    expect(branch).toMatchObject({
      ahead: 0,
      behind: 3,
      stashes: looked.stashes,
    });
    expect(
      primaryGitAction({ statusToken: 'token', changes: [], branch }),
    ).toEqual({ kind: 'run', action: 'pull', label: 'Pull' });
  });

  it('suggests pushing as many commits as the change list says are ahead', () => {
    const branch = shownBranch(
      { name: 'refs/heads/main', upstream: 'origin/main', ahead: 2, behind: 0 },
      looked,
    );
    const status = { statusToken: 'token', changes: [], branch };
    expect(suggestedCount(primaryGitAction(status), status)).toBe(2);
  });

  it('ignores a detailed read of another branch or upstream', () => {
    const overview = {
      name: 'refs/heads/feature',
      upstream: undefined,
      ahead: 0,
      behind: 0,
    };
    expect(shownBranch(overview, looked)).toEqual(overview);
  });

  it('uses the change list alone without a detailed read', () => {
    const overview = {
      name: 'refs/heads/main',
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
    };
    expect(shownBranch(overview, undefined)).toEqual(overview);
  });
});
