import { describe, expect, it } from 'vitest';
import { ScriptedWorktreeAccessReader } from '@porcelain/kernel/fakes';
import {
  WorktreeNotFoundError,
  WorktreeUnavailableError,
} from '@porcelain/projects/errors';
import { CheckWorktreeService } from './check-worktree-service.ts';

const worktree = { id: 'worktree-1', projectId: 'project-1' };

function setup() {
  const access = new ScriptedWorktreeAccessReader();
  return { access, service: new CheckWorktreeService(access) };
}

describe('CheckWorktreeService', () => {
  it('answers a known worktree for reading', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: false });
    await expect(service.execute({ worktreeId: worktree.id })).resolves.toEqual(
      worktree,
    );
  });

  it('answers a writable worktree for writing', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: true });
    await expect(
      service.execute({ worktreeId: worktree.id, purpose: 'writing' }),
    ).resolves.toEqual(worktree);
  });

  it('refuses to write to a worktree that may only be read', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: false });
    await expect(
      service.execute({ worktreeId: worktree.id, purpose: 'writing' }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });

  it('refuses a worktree it has never seen', async () => {
    const { service } = setup();
    await expect(service.execute({ worktreeId: 'unknown' })).rejects.toThrow(
      WorktreeNotFoundError,
    );
  });

  it('refuses a worktree whose repository cannot be listed right now', async () => {
    const { access, service } = setup();
    access.unreadable(worktree.id);
    await expect(service.execute({ worktreeId: worktree.id })).rejects.toThrow(
      WorktreeUnavailableError,
    );
  });

  it('answers a worktree inside the project the caller named', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: true });
    await expect(
      service.execute({ worktreeId: worktree.id, projectId: 'project-1' }),
    ).resolves.toEqual(worktree);
  });

  it('refuses a worktree that belongs to another project than the one named', async () => {
    const { access, service } = setup();
    access.present(worktree, { writable: true });
    await expect(
      service.execute({ worktreeId: worktree.id, projectId: 'project-2' }),
    ).rejects.toThrow(WorktreeNotFoundError);
  });
});
