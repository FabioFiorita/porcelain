import { describe, expect, it } from 'vitest';
import { IncompleteDiffReadError } from '@porcelain/changes/errors';
import { ReadChangeDiffsService } from './read-change-diffs-service.ts';
import { modified } from '../../spec/fakes/comparisons.ts';
import {
  diffKey,
  ScriptedChangeDiffReader,
} from '../../spec/fakes/scripted-change-diff-reader.ts';

const a = modified('unstaged', 'a.md');
const b = modified('staged', 'b.md');

describe('ReadChangeDiffsService', () => {
  it('pairs each selected comparison with its diff, in request order', async () => {
    const read = new ReadChangeDiffsService(
      new ScriptedChangeDiffReader(
        new Map([
          [diffKey(b), { kind: 'metadata-only', patch: '' }],
          [diffKey(a), { kind: 'text', patch: 'patch-a' }],
        ]),
      ),
    );
    expect(
      await read.execute({ worktreeId: 'w', comparisons: [a, b] }),
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
    const read = new ReadChangeDiffsService(
      new ScriptedChangeDiffReader(
        new Map([[diffKey(a), { kind: 'text', patch: 'patch-a' }]]),
      ),
    );
    await expect(
      read.execute({ worktreeId: 'w', comparisons: [a, b] }),
    ).rejects.toThrow(IncompleteDiffReadError);
  });
});
