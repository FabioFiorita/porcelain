import { describe, expect, it } from 'vitest';
import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { WorktreeCheck } from '@porcelain/kernel/models';
import type { ListedWorktree } from '@porcelain/projects/models';
import { listedWorktree } from './checkout-session.ts';

const worktree: ListedWorktree = {
  id: 'worktree-1',
  projectId: 'project-1',
  repositoryId: 'repository-1',
  path: '/srv/api',
  branch: 'refs/heads/main',
  main: true,
  available: true,
  metadataIdentity: 'metadata-1',
  administrativeDirectory: '/srv/api/.git',
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'repository-1',
};

function answering(check: WorktreeCheck<ListedWorktree>) {
  return { known: async () => check };
}

describe('listedWorktree', () => {
  it('answers the worktree the catalog found on disk', async () => {
    expect(
      await listedWorktree(answering({ kind: 'found', worktree }), worktree.id),
    ).toEqual(worktree);
  });

  it('says a worktree the catalog does not know is not found', async () => {
    await expect(
      listedWorktree(answering({ kind: 'missing' }), 'unknown'),
    ).rejects.toThrow(WorktreeNotFoundError);
  });

  it('says a known worktree whose repository no longer matches on disk is a mismatch', async () => {
    await expect(
      listedWorktree(answering({ kind: 'unavailable' }), worktree.id),
    ).rejects.toMatchObject({ name: 'RepositoryIdentityMismatchError' });
  });
});
