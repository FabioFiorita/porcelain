import { describe, expect, it } from 'vitest';
import {
  WorktreeNotFoundError,
  WorktreeUnavailableError,
} from '@porcelain/changes/errors';
import { ScriptedWorktreeAccess } from '../../spec/fakes/scripted-worktree-access.ts';
import { CheckWorktreeService } from './check-worktree-service.ts';

const worktree = { id: 'worktree-1', projectId: 'project-1' };

function setup() {
  const access = new ScriptedWorktreeAccess();
  return { access, service: new CheckWorktreeService(access) };
}

describe('CheckWorktreeService', () => {
  it('answers a known worktree even when it cannot be written', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: false });
    await expect(service.execute({ worktreeId: worktree.id })).resolves.toEqual(
      worktree,
    );
  });

  it('refuses a worktree no project lists', async () => {
    const { service } = setup();
    await expect(service.execute({ worktreeId: 'unknown' })).rejects.toThrow(
      WorktreeNotFoundError,
    );
  });

  it('refuses a worktree whose repository cannot be listed', async () => {
    const { access, service } = setup();
    access.unreadable(worktree.id);
    await expect(service.execute({ worktreeId: worktree.id })).rejects.toThrow(
      WorktreeUnavailableError,
    );
  });
});
