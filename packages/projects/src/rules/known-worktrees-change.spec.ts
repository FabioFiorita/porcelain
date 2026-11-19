import { describe, expect, it } from 'vitest';
import type {
  ListedWorktree,
  ProjectWorktrees,
} from '@porcelain/projects/models';
import { knownWorktreesChange } from './known-worktrees-change.ts';

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

describe('knownWorktreesChange', () => {
  it('sees no change when every project and worktree reads the same', () => {
    expect(knownWorktreesChange(listing([main]), listing([{ ...main }]))).toBe(
      undefined,
    );
  });

  it('sees a project that became unavailable', () => {
    expect(
      knownWorktreesChange(
        listing([main]),
        listing([{ ...main, available: false }], false),
      ),
    ).toBe('inventory');
  });

  it('sees a worktree that switched branch, appeared or went away', () => {
    const linked = { ...main, id: 'worktree-2', main: false, path: '/w/two' };
    expect(
      knownWorktreesChange(
        listing([main]),
        listing([{ ...main, branch: 'refs/heads/topic' }]),
      ),
    ).toBe('inventory');
    expect(knownWorktreesChange(listing([main]), listing([main, linked]))).toBe(
      'inventory',
    );
    expect(knownWorktreesChange(listing([main, linked]), listing([main]))).toBe(
      'inventory',
    );
  });

  it('sees a worktree whose head moved to a newer commit', () => {
    expect(
      knownWorktreesChange(
        listing([{ ...main, headCommittedAt: '2026-10-30T12:00:00.000Z' }]),
        listing([{ ...main, headCommittedAt: '2026-10-31T08:00:00.000Z' }]),
      ),
    ).toBe('inventory');
  });

  it('tells uncommitted work apart from a change to the listing itself', () => {
    const edited = {
      ...main,
      uncommittedChangedAt: '2026-10-31T09:00:00.000Z',
    };
    expect(knownWorktreesChange(listing([main]), listing([edited]))).toBe(
      'activity',
    );
    expect(knownWorktreesChange(listing([edited]), listing([main]))).toBe(
      'activity',
    );
    expect(
      knownWorktreesChange(
        listing([main]),
        listing([{ ...edited, branch: 'refs/heads/topic' }]),
      ),
    ).toBe('inventory');
  });

  it('ignores identities that only Git plumbing reads', () => {
    expect(
      knownWorktreesChange(
        listing([main]),
        listing([{ ...main, metadataIdentity: 'metadata-2' }]),
      ),
    ).toBe(undefined);
  });
});

it('publishes a new reason when an unavailable project changes from missing to permission denied', () => {
  expect(
    knownWorktreesChange(
      [
        {
          projectId: 'project',
          available: false,
          unavailableReason: 'missing',
          worktrees: [],
        },
      ],
      [
        {
          projectId: 'project',
          available: false,
          unavailableReason: 'permission',
          worktrees: [],
        },
      ],
    ),
  ).toBe('inventory');
});
