import { describe, expect, it } from 'vitest';
import { DirectoryTooLargeError } from '@porcelain/files/errors';
import { MemoryWorktreePaths } from '../../spec/fakes/memory-worktree-paths.ts';
import { ListWorktreePathsService } from './list-worktree-paths-service.ts';

const worktreeId = 'a'.repeat(32);

describe('ListWorktreePathsService', () => {
  it('answers every listed path of the worktree', async () => {
    const service = new ListWorktreePathsService(
      new MemoryWorktreePaths(['README.md', 'src/app.ts'], 2),
    );
    await expect(service.execute({ worktreeId })).resolves.toEqual({
      worktreeId,
      paths: ['README.md', 'src/app.ts'],
    });
  });

  it('refuses a worktree with more paths than can be listed', async () => {
    const service = new ListWorktreePathsService(
      new MemoryWorktreePaths(['a', 'b', 'c'], 2),
    );
    await expect(service.execute({ worktreeId })).rejects.toThrow(
      DirectoryTooLargeError,
    );
  });
});
