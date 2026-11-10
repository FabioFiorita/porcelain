import { describe, expect, it } from 'vitest';
import {
  changeEntries,
  changesSummary,
  walkthroughChangeEntries,
} from './changes-page';
import type { ReviewSnapshot } from './comparison';

function edit(scope: 'staged' | 'unstaged', path: string, supported = true) {
  const mode = '100644';
  return {
    scope,
    kind: 'modified',
    oldPath: path,
    newPath: path,
    oldMode: mode,
    newMode: mode,
    oldOid: 'a',
    newOid: 'b',
    supported,
  } as const;
}

const worktree: ReviewSnapshot = {
  kind: 'worktree',
  answer: {
    ...{ environmentId: 'env', worktreeId: 'tree', statusToken: 'look' },
    ...{ headOid: 'head', inProgress: undefined, mergeHeadOid: undefined },
    branch: undefined,
    changes: [
      {
        path: 'src/app.ts',
        fingerprint: 'app',
        comparisons: [
          edit('staged', 'src/app.ts'),
          edit('unstaged', 'src/app.ts'),
        ],
      },
      {
        path: 'notes.md',
        fingerprint: 'notes',
        comparisons: [{ scope: 'untracked', path: 'notes.md' }],
      },
      {
        path: 'merge.ts',
        fingerprint: undefined,
        comparisons: [
          { scope: 'unmerged', path: 'merge.ts', conflict: 'both-modified' },
        ],
      },
      {
        path: 'image.bin',
        fingerprint: 'image',
        comparisons: [edit('unstaged', 'image.bin', false)],
      },
    ],
  },
};

const renamed = {
  path: 'lib/next.ts',
  oldPath: 'lib/prior.ts',
  newPath: 'lib/next.ts',
  status: 'renamed',
  oldMode: '100755',
  newMode: '100755',
  fingerprint: 'content',
} as const;

function branchSnapshot(based: boolean): ReviewSnapshot {
  return {
    kind: 'branch',
    answer: {
      worktreeId: 'tree',
      head: { branch: 'topic', oid: 'tip' },
      base: based ? { ref: 'refs/heads/trunk', oid: 'base' } : undefined,
      mergeBaseOid: based ? 'ancestor' : undefined,
      commits: 3,
      files: [renamed],
    },
  };
}

describe('all changes of a worktree', () => {
  it('reads each comparison of a file as its own section, in the order Changes lists them', () => {
    expect(
      changeEntries(worktree).map((entry) => [
        entry.key,
        entry.details,
        entry.read.kind,
      ]),
    ).toEqual([
      ['src/app.ts\0staged', ['staged'], 'diff'],
      ['src/app.ts\0unstaged', ['unstaged'], 'diff'],
      ['notes.md\0untracked', ['untracked'], 'untracked'],
      ['merge.ts\0unmerged', ['conflict: both-modified'], 'notice'],
      ['image.bin\0unstaged', ['unstaged'], 'notice'],
    ]);
  });

  it('asks for the staged and unstaged patch with the file fingerprint', () => {
    expect(changeEntries(worktree)[1]?.read).toEqual({
      kind: 'diff',
      selection: {
        scope: 'unstaged',
        oldPath: 'src/app.ts',
        newPath: 'src/app.ts',
      },
      fingerprint: 'app',
    });
  });

  it('keeps both paths of a branch rename and explains a missing base', () => {
    expect(changeEntries(branchSnapshot(true))).toEqual([
      {
        key: 'lib/prior.ts\0lib/next.ts',
        path: 'lib/next.ts',
        details: ['renamed from lib/prior.ts'],
        scope: undefined,
        read: { kind: 'branch', paths: ['lib/prior.ts', 'lib/next.ts'] },
      },
    ]);
    expect(changesSummary(branchSnapshot(true), 1).subtitle).toBe(
      'Branch · trunk',
    );
    expect(changeEntries(branchSnapshot(false))[0]?.read).toEqual({
      kind: 'notice',
      title: 'No comparison base',
    });
  });
});

it('walkthrough code includes the dirty step and the whole change after committed code, with the file comparison retained', () => {
  const branch = branchSnapshot(true);
  expect(
    walkthroughChangeEntries(branch, worktree, ['notes.md']).map((file) => [
      file.path,
      file.comparison.kind,
      file.read.kind,
    ]),
  ).toEqual([['notes.md', 'worktree', 'untracked']]);
  expect(
    walkthroughChangeEntries(branch, worktree).map((file) => [
      file.path,
      file.comparison.kind,
    ]),
  ).toEqual([
    ['lib/next.ts', 'branch'],
    ['src/app.ts', 'worktree'],
    ['src/app.ts', 'worktree'],
    ['notes.md', 'worktree'],
    ['merge.ts', 'worktree'],
    ['image.bin', 'worktree'],
  ]);
});
