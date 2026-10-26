import { expect, it } from 'vitest';
import type { ReadGitStatusResponse } from '@porcelain/contracts/changes';
import { historyStatus } from './status';

const branch = {
  name: 'topic',
  upstream: 'origin/topic',
  ahead: 0,
  behind: 0,
  remoteName: 'origin',
  sourceRef: 'refs/heads/topic',
  upstreamOid: undefined,
  stashes: [],
  discarded: [],
};

const ordinary = {
  oldPath: 'file.ts',
  newPath: 'file.ts',
  oldMode: '100644',
  newMode: '100644',
  oldOid: undefined,
  newOid: undefined,
  supported: true,
};
it.each(['added', 'modified', 'deleted', 'renamed', 'type-changed'] as const)(
  'counts a %s file once across staged and unstaged changes',
  (kind) => {
    expect(
      historyStatus(
        {
          branch,
          changes: [
            { ...ordinary, kind, scope: 'staged' },
            { ...ordinary, kind, scope: 'unstaged' },
          ],
        },
        null,
      ).uncommitted,
    ).toBe('1 file');
  },
);

it.each([
  'both-deleted',
  'added-by-us',
  'deleted-by-them',
  'added-by-them',
  'deleted-by-us',
  'both-added',
  'both-modified',
] as const)(
  'counts untracked, deleted, renamed and %s conflicted files',
  (conflict) => {
    const changes: ReadGitStatusResponse['changes'] = [
      { scope: 'untracked', path: 'new.ts' },
      { scope: 'unmerged', path: 'conflict.ts', conflict },
      {
        ...ordinary,
        scope: 'unstaged',
        kind: 'deleted',
        oldPath: 'deleted.ts',
        newPath: undefined,
      },
      {
        ...ordinary,
        scope: 'staged',
        kind: 'renamed',
        oldPath: 'old.ts',
        newPath: 'renamed.ts',
      },
      {
        ...ordinary,
        scope: 'unstaged',
        kind: 'modified',
        oldPath: 'renamed.ts',
        newPath: 'renamed.ts',
      },
    ];
    expect(historyStatus({ branch, changes }, null).uncommitted).toBe(
      '4 files',
    );
  },
);

it('retains the branch and uncommitted files in an empty repository', () => {
  expect(
    historyStatus(
      {
        branch: { ...branch, name: 'new', upstream: undefined },
        changes: [{ scope: 'untracked', path: 'first.ts' }],
      },
      { tipOid: undefined, head: { kind: 'unborn', ref: 'refs/heads/new' } },
    ),
  ).toEqual({
    name: 'new',
    counts: null,
    upstream: 'No upstream',
    uncommitted: '1 file',
  });
});
