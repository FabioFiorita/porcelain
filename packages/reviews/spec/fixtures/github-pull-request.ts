import type { GitHubPullRequest } from '../../src/models/pull-request.ts';
export function githubPullRequest(
  overrides: Partial<GitHubPullRequest> = {},
): GitHubPullRequest {
  return {
    number: 423,
    title: 'Reviews per branch',
    url: 'https://github.com/FabioFiorita/porcelain/pull/423',
    state: 'OPEN',
    isDraft: false,
    author: { login: 'FabioFiorita' },
    headRefName: 'feat/review-per-branch',
    updatedAt: '2026-10-19T12:00:00Z',
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
                    name: 'CI',
                    status: 'COMPLETED',
                    conclusion: 'SUCCESS',
                    detailsUrl: 'https://github.com/check/1',
                  },
                  {
                    __typename: 'StatusContext',
                    context: 'deploy',
                    state: 'PENDING',
                    targetUrl: null,
                  },
                ],
                pageInfo: { hasNextPage: false },
              },
            },
          },
        },
      ],
    },
    body: '# Description',
    baseRefName: 'main',
    headRefOid: 'a'.repeat(40),
    mergeable: 'MERGEABLE',
    labels: {
      nodes: [{ name: 'feature', color: '123456' }],
      pageInfo: { hasNextPage: false },
    },
    comments: {
      nodes: [
        {
          id: 'comment',
          author: null,
          createdAt: '2026-10-19T11:00:00Z',
          body: 'Issue comment',
          url: 'https://github.com/comment',
        },
      ],
      pageInfo: { hasNextPage: false },
    },
    reviews: {
      nodes: [
        {
          id: 'review',
          author: { login: 'reviewer' },
          submittedAt: '2026-10-19T12:00:00Z',
          body: 'Review',
          url: 'https://github.com/review',
          state: 'APPROVED',
          comments: {
            nodes: [
              {
                id: 'inline',
                author: { login: 'reviewer' },
                createdAt: '2026-10-19T10:00:00Z',
                body: 'Inline comment',
                url: 'https://github.com/inline',
                path: 'src/index.ts',
                line: null,
                originalLine: 4,
              },
            ],
            pageInfo: { hasNextPage: false },
          },
        },
      ],
      pageInfo: { hasNextPage: false },
    },
    ...overrides,
  };
}
