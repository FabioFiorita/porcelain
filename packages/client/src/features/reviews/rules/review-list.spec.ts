import { expect, it } from 'vitest';
import {
  emptyReviewListFilter,
  filterReviewList,
  reviewListGroups,
  reviewListStatus,
  reviewListTitle,
  reviewListMeta,
  reviewListView,
  reviewListOptions,
  reviewListFilterItems,
  toggleReviewListFilter,
  type ReviewListEntry,
} from './review-list.ts';
import type { ReviewRevision } from './verdict.ts';

const layer = {
  id: 'owner',
  fingerprint: 'current',
  title: 'Owner',
  summary: 'Shared rule',
  lanes: ['Client'],
  steps: [],
};
const revision: Pick<ReviewRevision, 'content' | 'verdict'> = {
  verdict: {
    asked: { text: 'Explain the new owner' },
    recommendation: 'hold',
    reasons: ['Needs review'],
    notProven: [],
    removed: [],
  },
  content: {
    environmentId: 'beelink',
    worktreeId: 'worktree',
    revision: 1,
    publishedAt: '2026-10-20T12:00:00Z',
    active: true,
    diagnostics: 'current',
    summary: { token: 'summary', byteLength: 0, expires: '', signature: '' },
    layers: [layer, { ...layer, id: 'consumer' }],
    notExplained: [{ path: 'missed.ts', ranges: [] }],
    proof: {
      current: true,
      checks: [{ name: 'Browser', result: 'fail' }],
      assets: [],
    },
  },
};
const mark = {
  layerId: 'owner',
  fingerprint: 'current',
  reviewedAt: '2026-10-20T12:00:00Z',
};
const allMarks = {
  files: [],
  decisions: [mark, { ...mark, layerId: 'consumer' }],
};

it('orders only by the four review statuses', () => {
  expect(reviewListGroups).toEqual([
    'Needs you',
    'Waiting on agent',
    'Ready to merge',
    'No review',
  ]);
});
it('counts current decision marks once, ignoring file marks, stale and unrelated decisions', () => {
  const result = reviewListStatus({
    revision,
    status: 'pending',
    marks: {
      files: [
        {
          path: 'file',
          fingerprint: 'blob',
          reviewedAt: mark.reviewedAt,
          stale: false,
        },
      ],
      decisions: [
        mark,
        mark,
        { ...mark, layerId: 'consumer', fingerprint: 'old' },
        { ...mark, layerId: 'unrelated' },
      ],
    },
  });
  expect(result).toEqual({
    reviewed: 1,
    total: 2,
    group: 'Needs you',
    badges: [
      { label: 'Proof failed', variant: 'destructive' },
      { label: '1 not explained', variant: 'outline' },
      { label: 'Agent says hold', variant: 'secondary' },
    ],
  });
});
it('waits for the agent after review and requires both merge recommendation and every current decision to be ready', () => {
  expect(
    reviewListStatus({ revision, marks: allMarks, status: undefined }).group,
  ).toBe('Waiting on agent');
  const merge = {
    ...revision,
    verdict: { ...revision.verdict, recommendation: 'merge' as const },
  };
  expect(
    reviewListStatus({
      revision: merge,
      marks: { files: [], decisions: [mark] },
      status: 'pending',
    }).group,
  ).toBe('Needs you');
  expect(
    reviewListStatus({ revision: merge, marks: allMarks, status: 'reviewed' }),
  ).toMatchObject({
    group: 'Ready to merge',
    reviewed: 2,
    total: 2,
  });
  expect(
    reviewListStatus({ revision: merge, marks: allMarks, status: 'replied' })
      .badges,
  ).toContainEqual({ label: 'Agent replied', variant: 'default' });
  expect(
    reviewListStatus({
      revision,
      marks: { files: [], decisions: [mark] },
      status: 'reviewed',
    }).badges,
  ).toContainEqual({ label: 'Waiting for a commit', variant: 'secondary' });
});
it('an agent reply takes precedence over readiness or waiting', () => {
  const merge = {
    ...revision,
    verdict: { ...revision.verdict, recommendation: 'merge' as const },
  };
  expect(
    reviewListStatus({ revision: merge, marks: allMarks, status: 'replied' }),
  ).toMatchObject({
    group: 'Needs you',
  });
});
it('does not claim readiness while marks are unavailable or for an empty review', () => {
  expect(
    reviewListStatus({ revision, marks: undefined, status: undefined }),
  ).toMatchObject({ group: 'Needs you', reviewed: 0, total: 2 });
  expect(
    reviewListStatus({
      revision: {
        ...revision,
        verdict: { ...revision.verdict, recommendation: 'merge' },
        content: { ...revision.content, layers: [] },
      },
      marks: allMarks,
      status: undefined,
    }).group,
  ).toBe('Needs you');
});
it('uses the PR title, then the asked text, then the branch', () => {
  expect(reviewListTitle({ branch: 'feature' }, revision, 'PR title')).toBe(
    'PR title',
  );
  expect(reviewListTitle({ branch: 'feature' }, revision, undefined)).toBe(
    'Explain the new owner',
  );
  expect(reviewListTitle({ branch: 'feature' }, undefined, ' ')).toBe(
    'feature',
  );
});
const entry: ReviewListEntry = {
  key: 'a',
  environmentId: 'beelink',
  environmentName: 'Beelink',
  projectId: 'porcelain',
  projectName: 'Porcelain',
  worktreeId: 'worktree',
  path: '/code/feature',
  reviewId: 'review',
  branch: 'feature',
  title: 'Shared reviews',
  group: 'Needs you',
  closed: false,
  reviewed: 1,
  total: 2,
  badges: [],
  disabled: false,
  publishedAt: '2026-10-20T12:00:00Z',
  pullRequestNumber: '433',
};
const other: ReviewListEntry = {
  ...entry,
  key: 'b',
  projectId: 'tastik',
  projectName: 'Tastik',
  environmentId: 'mac',
  environmentName: 'MacBook',
  title: 'Mobile lists',
};
it('searches across projects and environments, intersects optional filters and keeps closed reviews separate', () => {
  const entries = [entry, other, { ...entry, key: 'closed', closed: true }];
  expect(
    filterReviewList(entries, '', emptyReviewListFilter, false).map(
      (row) => row.key,
    ),
  ).toEqual(['a', 'b']);
  expect(
    filterReviewList(
      entries,
      'porcelain 433 /code',
      emptyReviewListFilter,
      false,
    ).map((row) => row.key),
  ).toEqual(['a']);
  expect(
    filterReviewList(
      entries,
      '',
      { projects: ['beelink/porcelain'], environments: ['mac'] },
      false,
    ),
  ).toEqual([]);
  expect(
    filterReviewList(
      entries,
      '',
      { projects: [], environments: undefined },
      false,
    ),
  ).toEqual([]);
  expect(
    filterReviewList(entries, '', emptyReviewListFilter, true).map(
      (row) => row.key,
    ),
  ).toEqual(['closed']);
  expect(
    filterReviewList(
      [{ ...entry, reviewId: undefined, group: 'No review' }],
      'feature',
      emptyReviewListFilter,
      false,
    ),
  ).toHaveLength(1);
});
it('offers distinct scoped filters, lets the last checkbox be cleared and restores all choices by clearing filters', () => {
  const options = reviewListOptions([entry, entry, other]);
  expect(options.projects).toEqual([
    { id: 'beelink/porcelain', label: 'Porcelain · Beelink' },
    { id: 'mac/tastik', label: 'Tastik · MacBook' },
  ]);
  expect(options.environments).toEqual([
    { id: 'beelink', label: 'Beelink' },
    { id: 'mac', label: 'MacBook' },
  ]);
  expect(reviewListFilterItems(options.environments, undefined)).toEqual([
    { id: 'beelink', label: 'Beelink', checked: true, next: ['mac'] },
    { id: 'mac', label: 'MacBook', checked: true, next: ['beelink'] },
  ]);
  expect(toggleReviewListFilter(['mac'], 'mac')).toEqual([]);
  expect(toggleReviewListFilter([], 'mac')).toEqual(['mac']);
  expect(
    reviewListFilterItems(options.environments, []).map((item) => item.checked),
  ).toEqual([false, false]);
});
it('shows project, environment, PR or branch and a bounded relative publication time', () => {
  expect(reviewListMeta(entry, Date.parse('2026-10-20T12:04:00Z'))).toBe(
    'Porcelain · Beelink · #433 · 4m',
  );
  expect(
    reviewListMeta(
      { ...entry, pullRequestNumber: undefined },
      Date.parse('2026-10-20T13:00:00Z'),
    ),
  ).toBe('Porcelain · Beelink · feature · 1h');
  expect(
    reviewListMeta(
      { ...entry, publishedAt: undefined, pullRequestNumber: undefined },
      0,
    ),
  ).toBe('Porcelain · Beelink · feature');
});

it('combines search and checkbox state without changing the source entries', () => {
  const view = reviewListView(
    [entry, other],
    'Mobile',
    emptyReviewListFilter,
    false,
  );
  expect(view.rows.map((row) => row.key)).toEqual(['b']);
  expect(view.projectFilters).toHaveLength(2);
  expect(view.environmentFilters.map((item) => item.checked)).toEqual([
    true,
    true,
  ]);
});
