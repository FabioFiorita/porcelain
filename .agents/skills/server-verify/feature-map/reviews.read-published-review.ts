import { randomUUID } from 'node:crypto';
import { readPublishedReviewResponseSchema } from '../../../../packages/contracts/src/reviews/index.ts';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  unknownWorktreeId,
} from '../scripts/feature.ts';
import {
  read,
  sampleReview,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

export default defineFeature({
  feature: 'reviews.read-published-review',
  reaches: 'GET /api/worktrees/:worktreeId/review',
  intent: 'observed',
  behaviour:
    "A reviewer reads the worktree's published review, or null when none was published, exactly as the publish answered it.",
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
          body: sampleReview(0, randomUUID(), randomUUID()),
        }),
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/review'),
      }),
      expect({ response, state, check }) {
        check('status', 200, response.status);
        check('same as the publish answer', state, response.body);
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
