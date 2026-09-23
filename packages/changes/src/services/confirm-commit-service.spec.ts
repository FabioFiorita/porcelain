import { describe, expect, it } from 'vitest';
import { CommitNotFoundError } from '@porcelain/changes/errors';
import { ConfirmCommitService } from './confirm-commit-service.ts';
import { InMemoryCommitHistoryReader } from '../../spec/fakes/in-memory-commit-history-reader.ts';

describe('ConfirmCommitService', () => {
  it('reports a commit the repository does not have as not found', async () => {
    const confirm = new ConfirmCommitService(new InMemoryCommitHistoryReader());
    await expect(
      confirm.execute({
        worktreeId: 'w',
        oid: 'c'.repeat(40),
        parent: undefined,
      }),
    ).rejects.toThrow(CommitNotFoundError);
  });
});
