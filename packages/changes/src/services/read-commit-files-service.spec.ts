import { describe, expect, it } from 'vitest';
import { CommitNotFoundError } from '@porcelain/changes/errors';
import type { CommitFiles } from '@porcelain/changes/models';
import { ReadCommitFilesService } from './read-commit-files-service.ts';
import { InMemoryCommitHistoryReader } from '../../spec/fakes/in-memory-commit-history-reader.ts';

const oid = 'c'.repeat(40);
const files: CommitFiles = {
  commit: {
    oid,
    parentOids: [],
    author: { name: 'Author', timestamp: '2026-01-01T00:00:00.000Z' },
    subject: 'Initial commit',
    subjectTruncated: false,
    body: undefined,
    bodyTruncated: false,
    refs: [],
  },
  comparison: { kind: 'empty-tree' },
  files: [],
};

describe('ReadCommitFilesService', () => {
  it('returns the files of a commit the repository has', async () => {
    const history = new InMemoryCommitHistoryReader();
    history.commits.set(oid, files);
    const read = new ReadCommitFilesService(history);
    expect(
      await read.execute({ worktreeId: 'w', oid, parent: undefined }),
    ).toEqual(files);
  });

  it('reports a commit the repository does not have as not found', async () => {
    const read = new ReadCommitFilesService(new InMemoryCommitHistoryReader());
    await expect(
      read.execute({ worktreeId: 'w', oid, parent: undefined }),
    ).rejects.toThrow(CommitNotFoundError);
  });
});
