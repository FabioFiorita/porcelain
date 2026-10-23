import { expect, it } from 'vitest';
import type { ReadGitStatusResponse } from '@porcelain/contracts/changes';
import { historyStatus } from './status';

const branch = {
  name: 'refs/heads/topic',
  upstream: 'refs/remotes/origin/topic',
  ahead: 0,
  behind: 0,
  remoteName: 'origin',
  sourceRef: 'refs/heads/topic',
  upstreamOid: undefined,
  stashes: [],
  discarded: [],
};

it.each([
  [2, 0, '↑ 2 ahead · ↓ 0 behind · against origin/topic'],
  [0, 3, '↑ 0 ahead · ↓ 3 behind · against origin/topic'],
  [0, 0, '↑ 0 ahead · ↓ 0 behind · against origin/topic'],
  [2, 3, '↑ 2 ahead · ↓ 3 behind · against origin/topic'],
])(
  'compares %i ahead and %i behind with the named upstream',
  (ahead, behind, tracking) => {
    expect(
      historyStatus(
        { branch: { ...branch, ahead, behind }, changes: [] },
        null,
      ),
    ).toEqual({
      name: 'topic',
      tracking,
      uncommitted: undefined,
    });
  },
);

it.each([undefined, ''])(
  'does not invent counts without upstream %s',
  (upstream) => {
    expect(
      historyStatus(
        { branch: { ...branch, upstream, ahead: 2, behind: 3 }, changes: [] },
        null,
      ).tracking,
    ).toBe('No upstream');
  },
);

it.each([undefined, ''])(
  'shows detached HEAD without a branch name %s',
  (name) => {
    expect(
      historyStatus(
        { branch: { ...branch, name }, changes: [] },
        { tipOid: undefined, head: { kind: 'detached' } },
      ),
    ).toEqual({
      name: 'Detached HEAD',
      tracking: 'No branch checked out',
      uncommitted: undefined,
    });
  },
);

it.each([
  [{ kind: 'attached' as const, ref: 'refs/heads/main' }, 'main'],
  [{ kind: 'unborn' as const, ref: 'refs/heads/new' }, 'No commits yet on new'],
  [{ kind: 'detached' as const }, 'Detached HEAD'],
])(
  'keeps the history heading when branch status is missing: %s',
  (head, name) => {
    expect(historyStatus({ changes: [] }, { tipOid: undefined, head })).toEqual(
      {
        name,
        tracking: 'Branch status unavailable',
        uncommitted: undefined,
      },
    );
  },
);

it('keeps complete long branch and upstream names available to accessibility', () => {
  const name = `topic/${'long-'.repeat(40)}branch`;
  expect(
    historyStatus(
      {
        branch: {
          ...branch,
          name: `refs/heads/${name}`,
          upstream: `refs/remotes/origin/${name}`,
        },
        changes: [],
      },
      null,
    ),
  ).toEqual({
    name,
    tracking: `↑ 0 ahead · ↓ 0 behind · against origin/${name}`,
    uncommitted: undefined,
  });
});

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
        branch: { ...branch, name: 'refs/heads/new', upstream: undefined },
        changes: [{ scope: 'untracked', path: 'first.ts' }],
      },
      { tipOid: undefined, head: { kind: 'unborn', ref: 'refs/heads/new' } },
    ),
  ).toEqual({
    name: 'new',
    tracking: 'No upstream',
    uncommitted: '1 file',
  });
});
