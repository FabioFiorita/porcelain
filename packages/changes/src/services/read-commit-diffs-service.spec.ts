import { describe, expect, it } from 'vitest';
import { ReadCommitDiffsService } from './read-commit-diffs-service.ts';
import { InMemoryCommitHistoryReader } from '../../spec/fakes/in-memory-commit-history-reader.ts';

const oid = 'c'.repeat(40);

describe('ReadCommitDiffsService', () => {
  it('answers each requested path group with its patch, in request order', async () => {
    const history = new InMemoryCommitHistoryReader();
    history.patches.set(oid, {
      kind: 'within-limit',
      patches: [
        {
          paths: ['README.md', 'GUIDE.md'],
          content: { kind: 'metadata-only', patch: 'rename' },
        },
        { paths: ['a.md'], content: { kind: 'text', patch: 'patch-a' } },
      ],
    });
    const read = new ReadCommitDiffsService(history);
    expect(
      await read.execute({
        worktreeId: 'w',
        oid,
        parent: undefined,
        paths: [['a.md'], ['README.md', 'GUIDE.md']],
      }),
    ).toEqual({
      commitOid: oid,
      diffs: [
        { paths: ['a.md'], content: { kind: 'text', patch: 'patch-a' } },
        {
          paths: ['README.md', 'GUIDE.md'],
          content: { kind: 'metadata-only', patch: 'rename' },
        },
      ],
    });
  });

  it('answers a path the commit did not touch with an empty metadata-only patch', async () => {
    const read = new ReadCommitDiffsService(new InMemoryCommitHistoryReader());
    const { diffs } = await read.execute({
      worktreeId: 'w',
      oid,
      parent: undefined,
      paths: [['untouched.md']],
    });
    expect(diffs).toEqual([
      {
        paths: ['untouched.md'],
        content: { kind: 'metadata-only', patch: '' },
      },
    ]);
  });

  it('omits every diff when the commit is over the read limit', async () => {
    const history = new InMemoryCommitHistoryReader();
    history.patches.set(oid, { kind: 'over-limit' });
    const read = new ReadCommitDiffsService(history);
    const { diffs } = await read.execute({
      worktreeId: 'w',
      oid,
      parent: undefined,
      paths: [['a.md'], ['b.md']],
    });
    expect(diffs.map((diff) => diff.content)).toEqual([
      { kind: 'omitted', reason: 'size-limit' },
      { kind: 'omitted', reason: 'size-limit' },
    ]);
  });
});
