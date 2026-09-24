import { describe, expect, it } from 'vitest';
import { CommitNotFoundError } from '@porcelain/changes/errors';
import { CheckCommitService } from './check-commit-service.ts';
import { rootCommit } from '../../spec/fakes/commits.ts';
import { InMemoryCommitHistoryReader } from '../../spec/fakes/in-memory-commit-history-reader.ts';

const oid = 'c'.repeat(40);

describe('CheckCommitService', () => {
  it('accepts a commit the repository has', async () => {
    const history = new InMemoryCommitHistoryReader();
    history.commits.set(oid, rootCommit(oid));
    const check = new CheckCommitService(history);
    await expect(
      check.execute({ worktreeId: 'w', oid, parent: undefined }),
    ).resolves.toBeUndefined();
  });

  it('reports a commit the repository does not have as not found', async () => {
    const check = new CheckCommitService(new InMemoryCommitHistoryReader());
    await expect(
      check.execute({ worktreeId: 'w', oid, parent: undefined }),
    ).rejects.toThrow(CommitNotFoundError);
  });
});
