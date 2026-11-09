import { expect, it } from 'vitest';
import type { PullRequestRead } from '@porcelain/client/reviews/rules';
import { pullRequestMarkdown } from './pull-request-document';

type PullRequest = Extract<
  PullRequestRead,
  { kind: 'available' }
>['pullRequest'];
const pull: PullRequest = {
  number: 42,
  title: 'Read a pull request',
  url: 'https://github.com/example/repository/pull/42',
  state: 'open',
  draft: false,
  headBranch: 'feature',
  baseBranch: 'main',
  headSha: 'abc',
  matchesReviewHead: true,
  mergeable: 'MERGEABLE',
  updatedAt: '2026-10-30T00:00:00Z',
  description: 'A **Markdown** description.',
  labels: [{ name: 'bug', color: 'ff0000' }],
  checks: [
    {
      name: 'checks',
      status: 'COMPLETED',
      conclusion: 'FAILURE',
      detailsUrl: 'https://github.com/example/check',
    },
  ],
  checksTruncated: false,
  timeline: [
    {
      id: 'review',
      kind: 'review',
      author: 'reviewer',
      time: '2026-10-30T01:00:00Z',
      body: 'Please check this.',
      url: 'https://github.com/example/review',
      reviewState: 'CHANGES_REQUESTED',
    },
    {
      id: 'reply',
      kind: 'review-comment',
      reviewId: 'review',
      author: 'author',
      time: '2026-10-30T02:00:00Z',
      body: 'The code reply.',
      url: 'https://github.com/example/reply',
      path: 'src/code.ts',
      line: 7,
      diffHunk: '@@ -1 +1 @@\n-old\n+new',
    },
  ],
  truncated: true,
};

it('retains Markdown, check failure, nested code reply and incomplete conversation disclosure', () => {
  const source = pullRequestMarkdown(pull);
  expect(source).toContain('A **Markdown** description.');
  expect(source).toContain('Labels: bug');
  expect(source).toContain(
    '[checks](https://github.com/example/check): FAILURE',
  );
  expect(source).toContain('1 of 1 check failed');
  expect(source).toContain('reviewer · CHANGES_REQUESTED');
  expect(source).toContain('author · src/code.ts:7');
  expect(source).toContain('```diff\n@@ -1 +1 @@\n-old\n+new\n```');
  expect(source.split('The code reply.')).toHaveLength(2);
  expect(source.indexOf('Please check this.')).toBeLessThan(
    source.indexOf('The code reply.'),
  );
  expect(source).toContain('Conversation is incomplete.');
});

it('distinguishes an empty description and conversation from truncated checks', () => {
  const source = pullRequestMarkdown({
    ...pull,
    description: '',
    timeline: [],
    checks: [],
    checksTruncated: true,
    checksSummary: 'FAILURE',
    truncated: false,
  });
  expect(source).toContain('No description provided.');
  expect(source).toContain('No conversation yet.');
  expect(source).toContain('Checks failing');
  expect(source).toContain('Checks list is incomplete.');
  expect(source).not.toContain('Conversation is incomplete.');
});
