import { describe, expect, it } from 'vitest';
import { IncompleteDiffReadError } from '@porcelain/changes/errors';
import { ReadChangeDiffsService } from './read-change-diffs-service.ts';
import { modified } from '../../spec/fakes/comparisons.ts';
import { ScriptedChangeDiffReader } from '../../spec/fakes/scripted-change-diff-reader.ts';

const comparisons = [modified('unstaged', 'a.md'), modified('staged', 'b.md')];

describe('ReadChangeDiffsService', () => {
  it('pairs each selected comparison with its diff, in request order', async () => {
    const diffs = new ScriptedChangeDiffReader();
    diffs.contents.push(
      { kind: 'text', patch: 'patch-a' },
      { kind: 'metadata-only', patch: '' },
    );
    const read = new ReadChangeDiffsService(diffs);
    expect(await read.execute({ worktreeId: 'w', comparisons })).toEqual([
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
    const diffs = new ScriptedChangeDiffReader();
    diffs.contents.push({ kind: 'text', patch: 'patch-a' });
    const read = new ReadChangeDiffsService(diffs);
    await expect(
      read.execute({ worktreeId: 'w', comparisons }),
    ).rejects.toThrow(IncompleteDiffReadError);
  });
});
