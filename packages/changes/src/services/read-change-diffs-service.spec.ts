import { describe, expect, it } from 'vitest';
import { IncompleteDiffReadError } from '@porcelain/changes/errors';
import { ReadChangeDiffsService } from './read-change-diffs-service.ts';
import { modified } from '../../spec/fakes/comparisons.ts';
import { InMemoryChangeDiffReader } from '../../spec/fakes/in-memory-change-diff-reader.ts';

describe('ReadChangeDiffsService', () => {
  it('pairs each selected comparison with its diff', async () => {
    const diffs = new InMemoryChangeDiffReader();
    diffs.patches.set('unstaged:a.md', 'patch-a');
    const read = new ReadChangeDiffsService(diffs);
    expect(
      await read.execute({
        worktreeId: 'w',
        comparisons: [modified('unstaged', 'a.md'), modified('staged', 'b.md')],
      }),
    ).toEqual([
      {
        selection: { scope: 'unstaged', oldPath: 'a.md', newPath: 'a.md' },
        content: { kind: 'text', patch: 'patch-a' },
      },
      {
        selection: { scope: 'staged', oldPath: 'b.md', newPath: 'b.md' },
        content: { kind: 'metadata-only', patch: '' },
      },
    ]);
  });

  it('fails instead of answering with a missing diff', async () => {
    const diffs = new InMemoryChangeDiffReader();
    diffs.dropLast = true;
    const read = new ReadChangeDiffsService(diffs);
    await expect(
      read.execute({
        worktreeId: 'w',
        comparisons: [modified('unstaged', 'a.md'), modified('staged', 'b.md')],
      }),
    ).rejects.toThrow(IncompleteDiffReadError);
  });
});
