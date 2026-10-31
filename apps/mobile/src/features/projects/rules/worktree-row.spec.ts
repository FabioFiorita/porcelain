import { expect, it } from 'vitest';
import type { NavigatorEntry } from '@porcelain/client/projects/rules';
import { worktreeRow } from './worktree-row';

const entry: NavigatorEntry = {
  key: 'computer/project/worktree',
  kind: 'worktree',
  environmentId: 'computer',
  environmentName: 'Private workstation',
  projectId: 'project',
  projectName: 'Porcelain',
  worktreeId: 'worktree',
  path: '/code/porcelain',
  name: 'feat/pinned-files',
  branch: 'feat/pinned-files',
  main: false,
  detached: false,
  available: true,
  review: { state: 'none' },
  changes: { state: 'available', count: 0 },
};

it('shows a branch once without clean-state filler', () => {
  expect(worktreeRow(entry)).toEqual({
    title: 'feat/pinned-files',
    review: 'No review',
    changes: '',
    diff: undefined,
  });
});

it('keeps full branch names and unknown progress distinct from zero decisions', () => {
  const branch = 'a-long-branch-name-'.repeat(12);
  const row = {
    ...entry,
    branch,
    changes: { state: 'loading' as const },
    review: {
      state: 'available' as const,
      reviewId: 'review',
      closed: false,
      archived: false,
      pullRequestNumber: 42,
      progress: undefined,
    },
  };
  expect(worktreeRow(row)).toEqual({
    title: branch,
    review: 'reading progress…',
    changes: 'Reading changes…',
    diff: undefined,
  });
  expect(
    worktreeRow({
      ...row,
      review: { ...row.review, progress: { reviewed: 0, total: 0 } },
    }).review,
  ).toBe('0/0 decisions');
});

it.each(['qa-531', 'qa-532'])(
  'shows detached checkout %s by folder with a compact identity',
  (name) => {
    expect(
      worktreeRow({
        ...entry,
        name,
        branch: 'Detached HEAD',
        detached: true,
        path: `/code/porcelain-worktrees/${name}`,
      }),
    ).toEqual({
      title: name,
      review: 'Detached · No review',
      changes: '',
      diff: undefined,
    });
  },
);

it('labels the main checkout and preserves failures instead of implying clean or no review', () => {
  expect(
    worktreeRow({
      ...entry,
      main: true,
      changes: { state: 'unavailable' },
      review: { state: 'unavailable' },
    }),
  ).toEqual({
    title: 'feat/pinned-files',
    review: 'Review unavailable',
    changes: 'Changes unavailable',
    diff: undefined,
  });
});

it('shows decision progress and numeric local changes without repeating review prose', () => {
  expect(
    worktreeRow({
      ...entry,
      review: {
        state: 'available',
        reviewId: 'review',
        closed: false,
        archived: false,
        pullRequestNumber: 42,
        progress: { reviewed: 2, total: 9 },
      },
      changes: {
        state: 'available',
        count: 2,
        summary: {
          state: 'available',
          additions: 7,
          deletions: 3,
          binaryFiles: 1,
        },
      },
    }),
  ).toEqual({
    title: 'feat/pinned-files',
    review: '2/9 decisions',
    changes: '+7 −3 · 1 binary',
    diff: { state: 'available', additions: 7, deletions: 3, binaryFiles: 1 },
  });
});

it.each([
  { state: 'loading' as const },
  { state: 'unavailable' as const },
  { state: 'available' as const, additions: 0, deletions: 0, binaryFiles: 0 },
])(
  'keeps a known changed file count when numeric details are %j',
  (summary) => {
    expect(
      worktreeRow({
        ...entry,
        changes: { state: 'available', count: 1, summary },
      }),
    ).toEqual({
      title: 'feat/pinned-files',
      review: 'No review',
      changes: '1 file',
      diff: undefined,
    });
  },
);
