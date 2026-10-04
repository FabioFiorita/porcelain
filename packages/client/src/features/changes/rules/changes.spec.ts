import { describe, expect, it } from 'vitest';
import {
  changeSelections,
  expectedDiffFiles,
  selectionKey,
} from './changes.ts';

const renamed: Parameters<typeof changeSelections>[0] = {
  scope: 'staged',
  kind: 'renamed',
  oldPath: 'old.ts',
  newPath: 'new.ts',
  oldMode: '100644',
  newMode: '100644',
  oldOid: undefined,
  newOid: undefined,
  supported: true,
};

describe('worktree diff selection', () => {
  it('keeps staged and unstaged rename paths and distinct selection keys', () => {
    const selections = [
      renamed,
      { ...renamed, scope: 'unstaged' as const },
    ].flatMap(changeSelections);
    expect(selections).toEqual([
      { scope: 'staged', oldPath: 'old.ts', newPath: 'new.ts' },
      { scope: 'unstaged', oldPath: 'old.ts', newPath: 'new.ts' },
    ]);
    expect(selections.map(selectionKey)).toEqual([
      'staged\nold.ts\nnew.ts',
      'unstaged\nold.ts\nnew.ts',
    ]);
  });
  it('leaves text reads and conflict reporting outside diff reads', () => {
    expect(changeSelections({ scope: 'untracked', path: 'new.ts' })).toEqual(
      [],
    );
    expect(
      changeSelections({
        scope: 'unmerged',
        path: 'conflict.ts',
        conflict: 'both-modified',
      }),
    ).toEqual([]);
    expect(
      expectedDiffFiles([
        {
          path: 'new.ts',
          fingerprint: 'rename-fingerprint',
          comparisons: [renamed],
        },
        {
          path: 'note.txt',
          fingerprint: 'note-fingerprint',
          comparisons: [{ scope: 'untracked', path: 'note.txt' }],
        },
      ]),
    ).toEqual([{ path: 'new.ts', fingerprint: 'rename-fingerprint' }]);
  });
});
