import { withReadLease } from '@porcelain/effects/worktree';
import { DirectoryTooLargeError } from '@porcelain/files/errors';
import { WorktreePathsReader } from '@porcelain/files/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryWorktreePathsReader } from '../../spec/fakes/in-memory-worktree-paths-reader.ts';
import { ListWorktreePathsService } from './list-worktree-paths-service.ts';

const worktreeId = 'a'.repeat(32);

describe('ListWorktreePathsService', () => {
  it('refuses a worktree whose paths could not all be listed', async () => {
    const service = Effect.runSync(
      ListWorktreePathsService.pipe(
        Effect.provide(ListWorktreePathsService.layer),
        Effect.provideService(
          WorktreePathsReader,
          new InMemoryWorktreePathsReader({ kind: 'too-large' }),
        ),
      ),
    );
    await expect(
      Effect.runPromise(
        withReadLease(worktreeId, service.execute({ worktreeId })),
      ),
    ).rejects.toThrow(DirectoryTooLargeError);
  });
});
