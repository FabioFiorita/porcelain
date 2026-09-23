import { describe, expect, it } from 'vitest';
import {
  WorktreeNotFoundError,
  WorktreeUnavailableError,
} from '@porcelain/reviews/errors';
import { ScriptedWorktreeAccess } from '../../spec/fakes/scripted-worktree-access.ts';
import { CheckWorktreeAccessService } from './check-worktree-access-service.ts';

const worktree = { id: 'worktree-1', projectId: 'project-1' };

function setup() {
  const access = new ScriptedWorktreeAccess();
  return { access, service: new CheckWorktreeAccessService(access) };
}

describe('CheckWorktreeAccessService', () => {
  it('lets a known worktree be read even when it cannot be written', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: false });
    await expect(
      service.execute({ worktreeId: worktree.id, intent: 'read' }),
    ).resolves.toEqual(worktree);
  });

  it('refuses to write a worktree that is not available', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: false });
    await expect(
      service.execute({ worktreeId: worktree.id, intent: 'write' }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });

  it('lets an available worktree be written', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: true });
    await expect(
      service.execute({ worktreeId: worktree.id, intent: 'write' }),
    ).resolves.toEqual(worktree);
  });

  it('refuses a worktree no project lists, for reading and for writing', async () => {
    const { service } = setup();
    await expect(
      service.execute({ worktreeId: 'unknown', intent: 'read' }),
    ).rejects.toThrow(WorktreeNotFoundError);
    await expect(
      service.execute({ worktreeId: 'unknown', intent: 'write' }),
    ).rejects.toThrow(WorktreeNotFoundError);
  });

  it('refuses a worktree whose repository cannot be listed', async () => {
    const { access, service } = setup();
    access.unreadable(worktree.id);
    await expect(
      service.execute({ worktreeId: worktree.id, intent: 'read' }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });
});
