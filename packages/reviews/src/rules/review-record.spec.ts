import { expect, it } from 'vitest';
import { reviewFixture, reviewSave } from '../../spec/fixtures/review.ts';
import {
  openReviewForKey,
  reviewRecordView,
  revisionMetadata,
} from './review-record.ts';
const record = reviewSave(reviewFixture()).record;
it('reuses an open branch review, promotes it to a PR, and separates another PR or closed review', () => {
  expect(
    openReviewForKey([record], { projectId: 'project', branch: 'feature' })
      ?.reviewId,
  ).toBe('10000000-0000-4000-8000-000000000001');
  expect(
    openReviewForKey([record], {
      projectId: 'project',
      branch: 'feature',
      pullRequest: 'https://github.com/a/b/pull/42',
    })?.reviewId,
  ).toBe(record.reviewId);
  expect(
    openReviewForKey(
      [{ ...record, pullRequest: 'https://github.com/a/b/pull/42' }],
      {
        projectId: 'project',
        branch: 'feature',
        pullRequest: 'https://github.com/a/b/pull/43',
      },
    ),
  ).toBeUndefined();
  expect(
    openReviewForKey([{ ...record, state: 'closed' }], {
      projectId: 'project',
      branch: 'feature',
    }),
  ).toBeUndefined();
  expect(
    openReviewForKey([record], { projectId: 'other', branch: 'feature' }),
  ).toBeUndefined();
});
it('keys a linked review by project and PR number across branch and repository rename', () => {
  expect(
    openReviewForKey(
      [{ ...record, pullRequest: 'https://github.com/a/b/pull/42' }],
      {
        projectId: 'project',
        branch: 'renamed',
        pullRequest: 'https://github.com/a/renamed/pull/42',
      },
    )?.reviewId,
  ).toBe(record.reviewId);
});
it('exposes durable labels without private repository paths or summary secrets', () => {
  expect(reviewRecordView(record)).toEqual({
    reviewId: '10000000-0000-4000-8000-000000000001',
    projectId: 'project',
    branch: 'feature',
    state: 'open',
    latestRevision: 1,
    lastSeenRevision: 0,
  });
  expect(revisionMetadata(reviewFixture())).toEqual({
    reviewId: record.reviewId,
    projectId: 'project',
    revision: 1,
    headOid: 'a'.repeat(40),
    base: 'refs/heads/main',
    baseOid: 'b'.repeat(40),
    mergeBaseOid: 'b'.repeat(40),
    publishedAt: '2026-10-19T00:00:00.000Z',
    branch: 'feature',
    worktreePath: '/repositories/project',
    worktreeName: 'project',
  });
});
