import { describe, expect, it } from 'vitest';
import type {
  ListedWorktree,
  ProjectWorktrees,
} from '@porcelain/projects/models';
import { knownWorktreesChanged } from './known-worktrees-changed.ts';

const main: ListedWorktree = {
  id: 'worktree-1',
  projectId: 'project-1',
  path: '/repositories/one',
  branch: 'refs/heads/main',
  main: true,
  available: true,
  metadataIdentity: 'metadata-1',
  administrativeDirectory: '/repositories/one/.git',
  commonDirectory: '/repositories/one/.git',
  repositoryIdentity: 'repository-1',
  repositoryId: 'repository-1',
};

function listing(
  worktrees: ListedWorktree[],
  available = true,
): ProjectWorktrees[] {
  return [{ projectId: 'project-1', available, worktrees }];
}

describe('knownWorktreesChanged', () => {
  it('sees no change when every project and worktree reads the same', () => {
    expect(knownWorktreesChanged(listing([main]), listing([{ ...main }]))).toBe(
      false,
    );
  });

  it('sees a project that became unavailable', () => {
    expect(
      knownWorktreesChanged(
        listing([main]),
        listing([{ ...main, available: false }], false),
      ),
    ).toBe(true);
  });

  it('sees a worktree that switched branch, appeared or went away', () => {
    const linked = { ...main, id: 'worktree-2', main: false, path: '/w/two' };
    expect(
      knownWorktreesChanged(
        listing([main]),
        listing([{ ...main, branch: 'refs/heads/topic' }]),
      ),
    ).toBe(true);
    expect(
      knownWorktreesChanged(listing([main]), listing([main, linked])),
    ).toBe(true);
    expect(
      knownWorktreesChanged(listing([main, linked]), listing([main])),
    ).toBe(true);
  });

  it('ignores identities that only Git plumbing reads', () => {
    expect(
      knownWorktreesChanged(
        listing([main]),
        listing([{ ...main, metadataIdentity: 'metadata-2' }]),
      ),
    ).toBe(false);
  });
});
