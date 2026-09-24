import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { describe, expect, it } from 'vitest';
import { ScriptedWorktreeAccessReader } from '@porcelain/kernel/fakes';
import { WorktreeUnavailableError } from '@porcelain/projects/errors';
import { CheckWorktreeService } from './check-worktree-service.ts';

const worktree = {
  id: 'worktree-1',
  projectId: 'project-1',
  repositoryId: 'repository-1',
};

function service(
  worktrees: ConstructorParameters<typeof ScriptedWorktreeAccessReader>[0] = {},
) {
  return new CheckWorktreeService(new ScriptedWorktreeAccessReader(worktrees));
}

const readOnly = service({ readOnly: [worktree] });
const writable = service({ writable: [worktree] });

describe('CheckWorktreeService', () => {
  it('answers a known worktree for reading', async () => {
    await expect(
      readOnly.execute({ worktreeId: worktree.id }),
    ).resolves.toEqual(worktree);
  });

  it('answers a writable worktree for writing', async () => {
    await expect(
      writable.execute({ worktreeId: worktree.id, purpose: 'writing' }),
    ).resolves.toEqual(worktree);
  });

  it('refuses to write to a worktree that may only be read', async () => {
    await expect(
      readOnly.execute({ worktreeId: worktree.id, purpose: 'writing' }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });

  it('refuses a worktree it has never seen', async () => {
    await expect(writable.execute({ worktreeId: 'unknown' })).rejects.toThrow(
      WorktreeNotFoundError,
    );
  });

  it('refuses a worktree whose repository cannot be listed right now', async () => {
    await expect(
      service({ unreadable: [worktree.id] }).execute({
        worktreeId: worktree.id,
      }),
    ).rejects.toThrow(WorktreeUnavailableError);
  });

  it('answers a worktree inside the project the caller named', async () => {
    await expect(
      writable.execute({ worktreeId: worktree.id, projectId: 'project-1' }),
    ).resolves.toEqual(worktree);
  });

  it('refuses a worktree that belongs to another project than the one named', async () => {
    await expect(
      writable.execute({ worktreeId: worktree.id, projectId: 'project-2' }),
    ).rejects.toThrow(WorktreeNotFoundError);
  });
});
