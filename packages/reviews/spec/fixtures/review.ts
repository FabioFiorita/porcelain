import type {
  Review,
  ReviewRecord,
  ReviewSave,
} from '../../src/models/review.ts';

export function reviewFixture(overrides: Partial<Review> = {}): Review {
  return {
    reviewId: '10000000-0000-4000-8000-000000000001',
    projectId: 'project',
    commonDirectory: '/repositories/project/.git',
    worktreeId: 'a'.repeat(32),
    worktreePath: '/repositories/project',
    worktreeName: 'project',
    branch: 'feature',
    headOid: 'a'.repeat(40),
    base: 'refs/heads/main',
    baseOid: 'b'.repeat(40),
    mergeBaseOid: 'b'.repeat(40),
    files: [],
    notExplained: [],
    verdict: {
      asked: { text: 'Review committed work' },
      recommendation: 'merge',
      reasons: ['The requested behavior is verified'],
      notProven: [],
      removed: [],
    },
    revision: 1,
    publishedAt: '2026-10-19T00:00:00.000Z',
    active: true,
    summaryHtml: '<p>Review</p>',
    summaryToken: 'summary-1',
    summarySecret: 'secret',
    layers: [],
    ...overrides,
  };
}
export function reviewSave(
  review: Review,
  overrides: Partial<ReviewRecord> = {},
): ReviewSave & { record: ReviewRecord; expectedRevision: number } {
  return {
    ...review,
    expectedRevision: review.revision - 1,
    record: {
      reviewId: review.reviewId,
      projectId: review.projectId,
      commonDirectory: review.commonDirectory,
      branch: review.branch,
      state: 'open',
      latestRevision: review.revision,
      lastSeenRevision: 0,
      ...overrides,
    },
  };
}
