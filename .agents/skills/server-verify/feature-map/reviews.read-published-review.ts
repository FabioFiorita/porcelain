import { randomUUID } from 'node:crypto';
import { readPublishedReviewResponseSchema } from '@porcelain/contracts/reviews';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  record,
  unknownWorktreeId,
} from '../scripts/feature.ts';
import {
  read,
  sampleReview,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

function withoutSummaryUrl(body: unknown) {
  const review = record(record(body).review);
  const { url, ...summary } = record(review.summary);
  return { url: typeof url, review: { ...review, summary } };
}

export default defineFeature({
  feature: 'reviews.read-published-review',
  reaches: 'GET /api/worktrees/:worktreeId/review',
  paired: true,
  intent: 'observed',
  behaviour:
    "A reviewer reads the worktree's published review, or null when none was published, exactly as the publish answered it, with a freshly signed summary link.",
  cases: [
    defineCase({
      name: 'nothing published',
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/review'),
      }),
      expect({ response, check, checkContract }) {
        check('status', 200, response.status);
        check('body', { review: null }, response.body);
        checkContract(
          'contract',
          readPublishedReviewResponseSchema,
          response.body,
        );
      },
    }),
    defineCase({
      name: 'after a publish',
      setup: (session) =>
        read(session, {
          method: 'PUT',
          path: worktreePath(session, '/review'),
          body: sampleReview(session, 0, randomUUID(), randomUUID()),
        }),
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/review'),
      }),
      expect({ response, state, check }) {
        check('status', 200, response.status);
        check(
          'same as the publish answer apart from the freshly signed summary link',
          withoutSummaryUrl(state),
          withoutSummaryUrl(response.body),
        );
      },
    }),
    defineCase({
      name: 'unknown or malformed worktree',
      request: () => [
        { method: 'GET', path: `/api/worktrees/${unknownWorktreeId}/review` },
        { method: 'GET', path: '/api/worktrees/not-an-id/review' },
      ],
      expect({ responses, check }) {
        check('unknown status', 404, responses[0]?.status);
        check('unknown error body', worktreeNotFound, responses[0]?.body);
        check('malformed status', 400, responses[1]?.status);
        check('malformed error body', invalidRequest, responses[1]?.body);
      },
    }),
  ],
});
