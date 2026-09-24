import { describe, expect, it } from 'vitest';
import { ScriptedWorktreeAccess } from '@porcelain/kernel/fakes';
import {
  WorktreeNotFoundError,
  WorktreeUnavailableError,
} from '@porcelain/git-actions/errors';
import { CheckWorktreeService } from './check-worktree-service.ts';

const worktree = { id: 'worktree-1', projectId: 'project-1' };

function setup() {
  const access = new ScriptedWorktreeAccess();
  access.present(worktree, { writable: true });
  return { access, service: new CheckWorktreeService(access) };
}

describe('CheckWorktreeService', () => {
  it('answers a worktree of the named project', async () => {
    const { service } = setup();
    await expect(
      service.execute({ projectId: 'project-1', worktreeId: worktree.id }),
    ).resolves.toEqual(worktree);
  });

  it('refuses a worktree that belongs to another project', async () => {
    const { service } = setup();
    await expect(
      service.execute({ projectId: 'project-2', worktreeId: worktree.id }),
    ).rejects.toThrow(WorktreeNotFoundError);
  });

  it('refuses a worktree no project lists', async () => {
    const { service } = setup();
    await expect(
      service.execute({ projectId: 'project-1', worktreeId: 'unknown' }),
    ).rejects.toThrow(WorktreeNotFoundError);
  });

  it('refuses a worktree whose repository cannot be listed', async () => {
    const { access, service } = setup();
    access.unreadable(worktree.id);
    await expect(
      service.execute({ projectId: 'project-1', worktreeId: worktree.id }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });
});
