import { expect, it } from 'vitest';
import {
  githubPullRequest,
  pendingGitHubPullRequest,
} from '../../spec/fixtures/github-pull-request.ts';
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
    authorAvatarUrl: 'https://avatars.githubusercontent.com/u/1',
    createdAt: '2026-10-18T10:00:00Z',
    headBranch: 'feat/review-per-branch',
    baseBranch: 'main',
    description: '# Description',
    mergeable: 'MERGEABLE',
    matchesReviewHead: true,
    labels: [{ name: 'feature', color: '123456' }],
    updatedAt: '2026-10-19T12:00:00Z',
    truncated: false,
  });
  expect(mapped.timeline.find((item) => item.id === 'inline')).toMatchObject({
    reviewId: 'review',
    diffHunk: '@@ -3,2 +3,2 @@\n context\n-old\n+new',
    authorAvatarUrl: 'https://avatars.githubusercontent.com/u/2',
  });
  expect(mapped.timeline.find((item) => item.id === 'review')).toMatchObject({
    authorAvatarUrl: 'https://avatars.githubusercontent.com/u/2',
  });
  expect(
    mapped.timeline.find((item) => item.id === 'comment')?.authorAvatarUrl,
  ).toBeUndefined();
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

it.each([
  ['2026-10-19T12:00:00Z', '2026-10-19T12:01:48Z', 108000],
  ['2026-10-19T12:00:00Z', '2026-10-19T12:00:00Z', 0],
  ['2026-10-19T12:00:00Z', undefined, undefined],
  [undefined, '2026-10-19T12:01:48Z', undefined],
  [undefined, undefined, undefined],
  ['unreadable', '2026-10-19T12:01:48Z', undefined],
  ['2026-10-19T12:00:00Z', 'unreadable', undefined],
  ['2026-10-19T12:01:48Z', '2026-10-19T12:00:00Z', undefined],
] as const)(
  'maps only a valid completed check interval (%s, %s) to its duration',
  (startedAt, completedAt, durationMs) => {
    const raw = githubPullRequest({
      commits: {
        nodes: [
          {
            commit: {
              statusCheckRollup: {
                state: 'SUCCESS',
                contexts: {
                  nodes: [
                    {
                      __typename: 'CheckRun',
                      name: 'static',
                      status: 'COMPLETED',
                      conclusion: 'SUCCESS',
                      detailsUrl: 'https://github.com/check/1',
                      startedAt,
                      completedAt,
                    },
                  ],
                  pageInfo: { hasNextPage: false },
                },
              },
            },
          },
        ],
      },
    });
    expect(mapPullRequest(raw, raw.headRefOid).checks[0]?.durationMs).toBe(
      durationMs,
    );
  },
);

it('leaves legacy status checks without a duration', () => {
  expect(
    mapPullRequest(githubPullRequest(), 'head').checks[1]?.durationMs,
  ).toBeUndefined();
});

it('leaves running checks without a completed duration', () => {
  const raw = githubPullRequest();
  const check =
    raw.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes[0];
  if (check?.__typename !== 'CheckRun')
    throw new Error('Missing check fixture');
  const changed = {
    ...raw,
    commits: {
      nodes: [
        {
          commit: {
            statusCheckRollup: {
              state: 'PENDING',
              contexts: {
                nodes: [
                  {
                    ...check,
                    status: 'IN_PROGRESS',
                    startedAt: '2026-10-19T12:00:00Z',
                    completedAt: '2026-10-19T12:01:48Z',
                  },
                ],
                pageInfo: { hasNextPage: false },
              },
            },
          },
        },
      ],
    },
  };
  expect(
    mapPullRequest(changed, raw.headRefOid).checks[0]?.durationMs,
  ).toBeUndefined();
});

it('retains a pending review as the parent of its inline comments', () => {
  const raw = pendingGitHubPullRequest();
  const mapped = mapPullRequest(raw, raw.headRefOid);
  expect(mapped.timeline.find((item) => item.id === 'review')).toMatchObject({
    kind: 'review',
    time: '2026-10-19T09:00:00Z',
    reviewState: 'PENDING',
  });
  expect(mapped.timeline.find((item) => item.id === 'inline')?.reviewId).toBe(
    'review',
  );
});
