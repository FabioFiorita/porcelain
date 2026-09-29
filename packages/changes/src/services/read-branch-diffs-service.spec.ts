import { describe, expect, it } from 'vitest';
import { InMemoryBranchRangeReader } from '../../spec/fakes/in-memory-branch-range-reader.ts';
import { ReadBranchDiffsService } from './read-branch-diffs-service.ts';

const baseOid = 'b'.repeat(40);
const headOid = 'a'.repeat(40);
const range = `${baseOid}..${headOid}`;

describe('ReadBranchDiffsService', () => {
  it('answers each requested path group with its patch, in request order', async () => {
    const read = new ReadBranchDiffsService(
      new InMemoryBranchRangeReader({
        patches: {
          [range]: {
            kind: 'within-limit',
            patches: [
              {
                paths: ['old.md', 'new.md'],
                content: { kind: 'metadata-only', patch: 'rename' },
              },
              { paths: ['a.md'], content: { kind: 'text', patch: 'patch-a' } },
            ],
          },
        },
      }),
    );
    expect(
      await read.execute({
        worktreeId: 'w',
        baseOid,
        headOid,
        paths: [['a.md'], ['old.md', 'new.md']],
      }),
    ).toEqual({
      diffs: [
        { paths: ['a.md'], content: { kind: 'text', patch: 'patch-a' } },
        {
          paths: ['old.md', 'new.md'],
          content: { kind: 'metadata-only', patch: 'rename' },
        },
      ],
    });
  });

  it('refuses to answer a file Git read no patch for instead of calling it unchanged', async () => {
    const read = new ReadBranchDiffsService(
      new InMemoryBranchRangeReader({
        patches: {
          [range]: {
            kind: 'within-limit',
            patches: [
              {
                paths: ['old.md', 'new.md'],
                content: { kind: 'metadata-only', patch: 'rename' },
              },
            ],
          },
        },
      }),
    );
    await expect(
      read.execute({
        worktreeId: 'w',
        baseOid,
        headOid,
        paths: [['old.md'], ['new.md']],
      }),
    ).rejects.toMatchObject({ name: 'IncompleteDiffReadError' });
  });

  it('omits every diff when the range is over the read limit', async () => {
    const read = new ReadBranchDiffsService(
      new InMemoryBranchRangeReader({
        patches: { [range]: { kind: 'over-limit' } },
      }),
    );
    const { diffs } = await read.execute({
      worktreeId: 'w',
      baseOid,
      headOid,
      paths: [['a.md'], ['b.md']],
    });
    expect(diffs.map((diff) => diff.content)).toEqual([
      { kind: 'omitted', reason: 'size-limit' },
      { kind: 'omitted', reason: 'size-limit' },
    ]);
  });

  it('refuses a range whose commits the repository does not have', async () => {
    const read = new ReadBranchDiffsService(new InMemoryBranchRangeReader());
    await expect(
      read.execute({ worktreeId: 'w', baseOid, headOid, paths: [['a.md']] }),
    ).rejects.toMatchObject({ name: 'CommitNotFoundError' });
  });
});
