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
  const summary = Object.fromEntries(
    Object.entries(record(review.summary)).filter(([key]) => key !== 'url'),
  );
  return { ...review, summary };
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
      expect({ response, state, check, checkMatch }) {
        check('status', 200, response.status);
        check(
          'same as the publish answer apart from the freshly signed summary link',
          withoutSummaryUrl(state),
          withoutSummaryUrl(response.body),
        );
        checkMatch(
          'a freshly signed summary link',
          /^\/review-summaries\/[0-9a-f-]{36}\?expires=[^&]+&signature=[A-Za-z0-9_-]{43}$/,
          record(record(record(response.body).review).summary).url,
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
