import { describe, expect, it } from 'vitest';
import { ScriptedWorktreeAccess } from '@porcelain/kernel/fakes';
import {
  WorktreeNotFoundError,
  WorktreeUnavailableError,
} from '@porcelain/files/errors';
import { CheckWorktreeService } from './check-worktree-service.ts';

const worktree = { id: 'worktree-1', projectId: 'project-1' };

function setup() {
  const access = new ScriptedWorktreeAccess();
  return { access, service: new CheckWorktreeService(access) };
}

describe('CheckWorktreeService', () => {
  it('lets a known worktree be read even when it cannot be written', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: false });
    await expect(
      service.execute({ worktreeId: worktree.id, purpose: 'reading' }),
    ).resolves.toEqual(worktree);
  });

  it('refuses to write a worktree that is not available', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: false });
    await expect(
      service.execute({ worktreeId: worktree.id, purpose: 'writing' }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });

  it('lets an available worktree be written', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: true });
    await expect(
      service.execute({ worktreeId: worktree.id, purpose: 'writing' }),
    ).resolves.toEqual(worktree);
  });

  it('refuses a worktree no project lists, for reading and for writing', async () => {
    const { service } = setup();
    await expect(
      service.execute({ worktreeId: 'unknown', purpose: 'reading' }),
    ).rejects.toThrow(WorktreeNotFoundError);
    await expect(
      service.execute({ worktreeId: 'unknown', purpose: 'writing' }),
    ).rejects.toThrow(WorktreeNotFoundError);
  });

  it('refuses a worktree whose repository cannot be listed', async () => {
    const { access, service } = setup();
    access.unreadable(worktree.id);
    await expect(
      service.execute({ worktreeId: worktree.id, purpose: 'reading' }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });
});
