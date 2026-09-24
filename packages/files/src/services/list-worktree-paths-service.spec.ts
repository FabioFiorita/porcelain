import { describe, expect, it } from 'vitest';
import { DirectoryTooLargeError } from '@porcelain/files/errors';
import { InMemoryWorktreePathsReader } from '../../spec/fakes/in-memory-worktree-paths-reader.ts';
import { ListWorktreePathsService } from './list-worktree-paths-service.ts';

const worktreeId = 'a'.repeat(32);

describe('ListWorktreePathsService', () => {
  it('answers every listed path of the worktree', async () => {
    const service = new ListWorktreePathsService(
      new InMemoryWorktreePathsReader({
        kind: 'listed',
        paths: ['README.md', 'src/app.ts'],
      }),
    );
    await expect(service.execute({ worktreeId })).resolves.toEqual({
      worktreeId,
      paths: ['README.md', 'src/app.ts'],
    });
  });

  it('refuses a worktree whose paths could not all be listed', async () => {
    const service = new ListWorktreePathsService(
      new InMemoryWorktreePathsReader({ kind: 'too-large' }),
    );
    await expect(service.execute({ worktreeId })).rejects.toThrow(
      DirectoryTooLargeError,
    );
  });
});
