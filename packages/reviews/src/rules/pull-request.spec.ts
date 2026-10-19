import { expect, it } from 'vitest';
import { githubPullRequest } from '../../spec/fixtures/github-pull-request.ts';
import {
  mapPullRequest,
  mapPullRequestSummary,
  recentPullRequestCutoff,
} from './pull-request.ts';
it('maps headers, checks and a chronological timeline including deleted authors and outdated lines', () => {
  const mapped = mapPullRequest(githubPullRequest(), 'a'.repeat(40));
  expect(mapped).toMatchObject({
    number: 423,
    title: 'Reviews per branch',
    state: 'open',
    draft: false,
    author: 'FabioFiorita',
    headBranch: 'feat/review-per-branch',
    baseBranch: 'main',
    description: '# Description',
    mergeable: 'MERGEABLE',
    matchesReviewHead: true,
    labels: [{ name: 'feature', color: '123456' }],
    updatedAt: '2026-10-19T12:00:00Z',
    truncated: false,
  });
  expect(mapped.checks).toEqual([
    {
      name: 'CI',
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
      detailsUrl: 'https://github.com/check/1',
    },
    {
      name: 'deploy',
      status: 'PENDING',
      conclusion: undefined,
      detailsUrl: undefined,
    },
  ]);
  expect(
    mapped.timeline.map((item) => [
      item.kind,
      item.body,
      item.author,
      item.path,
      item.line,
      item.originalLine,
    ]),
  ).toEqual([
    [
      'review-comment',
      'Inline comment',
      'reviewer',
      'src/index.ts',
      undefined,
      4,
    ],
    ['comment', 'Issue comment', undefined, undefined, undefined, undefined],
    ['review', 'Review', 'reviewer', undefined, undefined, undefined],
  ]);
});
it.each([
  ['CLOSED', 'closed'],
  ['MERGED', 'merged'],
] as const)(
  'keeps closed and merged distinct, marks stale heads and reports bounded data',
  (state, expected) => {
    const raw = githubPullRequest({
      state,
      isDraft: true,
      commits: { nodes: [] },
      labels: { nodes: [], pageInfo: { hasNextPage: true } },
    });
    expect(mapPullRequest(raw, 'different')).toMatchObject({
      state: expected,
      draft: true,
      checks: [],
      checksSummary: undefined,
      checksTruncated: false,
      matchesReviewHead: false,
      truncated: true,
    });
  },
);

it('summarizes checks without losing the PR identity and defines the recent window as 30 days', () => {
  expect(mapPullRequestSummary(githubPullRequest())).toMatchObject({
    number: 423,
    checksSummary: 'SUCCESS',
    checksTruncated: false,
  });
  expect(recentPullRequestCutoff(Date.parse('2026-10-19T00:00:00Z'))).toBe(
    '2026-09-19T00:00:00.000Z',
  );
});
