import { describe, expect, it } from 'vite-plus/test';
import {
  gitActionBlocker,
  primaryGitAction,
  shownBranch,
  unlistedCommitNote,
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

describe('gitActionBlocker with changes left out of the list', () => {
  const partial = {
    statusToken: 'token',
    headOid: 'a'.repeat(40),
    changes: [{ scope: 'untracked' as const, path: 'bulk/file-00000.txt' }],
    omittedChanges: 4999,
    branch: { name: 'main', upstream: 'origin/main', ahead: 0, behind: 0 },
  };

  it('sends stashing and restoring a stash to a terminal', () => {
    expect(gitActionBlocker('stash-create', partial)).toBe(
      'Not every change is listed here, so stash these changes in a terminal.',
    );
    expect(gitActionBlocker('stash-pop', partial)).toBe(
      'Not every change is listed here, so pop this stash in a terminal.',
    );
  });

  it('sends a merge commit to a terminal but still commits listed files', () => {
    expect(
      gitActionBlocker('commit', {
        ...partial,
        inProgress: 'merge',
        mergeHeadOid: 'b'.repeat(40),
      }),
    ).toBe(
      'Not every change is listed here, so commit this merge in a terminal.',
    );
    expect(gitActionBlocker('commit', partial)).toBeNull();
    expect(
      gitActionBlocker('stash-create', {
        ...partial,
        omittedChanges: undefined,
      }),
    ).toBeNull();
  });

  it('notes in the commit form that unlisted changes stay out of the commit', () => {
    expect(unlistedCommitNote(partial)).toBe(
      '4,999 more changes are not listed and stay out of this commit.',
    );
    expect(
      unlistedCommitNote({ ...partial, omittedChanges: undefined }),
    ).toBeNull();
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
