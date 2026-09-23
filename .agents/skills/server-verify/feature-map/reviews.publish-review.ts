import { randomUUID } from 'node:crypto';
import { publishReviewResponseSchema } from '../../../../packages/contracts/src/reviews/index.ts';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  inventory,
  sampleReview,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const layerId = randomUUID();
const stepId = randomUUID();
const publish = (session: Session, body: unknown) => ({
  method: 'PUT' as const,
  path: worktreePath(session, '/review'),
  body,
});
const worktreeStatus = async (session: Session) =>
  record(
    list(record(list((await inventory(session)).projects)[0]).worktrees)[0],
  ).status;

export default defineFeature({
  feature: 'reviews.publish-review',
  reaches: 'PUT /api/worktrees/:worktreeId/review',
  intent: 'observed',
  behaviour:
    "An agent or reviewer publishes the worktree's review: an HTML summary, an optional diagram and layers of steps that point at code. Publishing replaces the previous review only if the publisher states the revision it last saw; each publish increments the revision. The server resolves every pointer against the worktree (fingerprinting the text and locating it as current or changed), lists changed lines no step explains, signs a link to the summary, and marks the worktree's review status as pending in the inventory.",
  cases: [
    defineCase({
      name: 'first publish',
      request: (session) => publish(session, sampleReview(0, layerId, stepId)),
      async expect({ response, session, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', publishReviewResponseSchema, response.body);
        const review = record(record(response.body).review);
        checkPartial(
          'review',
          {
            worktreeId: session.worktreeId,
            revision: 1,
            active: true,
            diagnostics: 'current',
            summary: { byteLength: 42 },
            layers: [
              {
                id: layerId,
                steps: [
                  {
                    id: stepId,
                    pointer: { path: 'README.md', startLine: 3, endLine: 3 },
                    location: { state: 'current', startLine: 3, endLine: 3 },
                  },
                ],
              },
            ],
            notExplained: [],
          },
          review,
        );
        check(
          'summary link is signed',
          true,
          /^\/review-summaries\/[0-9a-f-]{36}\?expires=\d+&signature=[A-Za-z0-9_-]{43}$/.test(
            String(record(review.summary).url),
          ),
        );
        check(
          'worktree review is pending',
          'pending',
          await worktreeStatus(session),
        );
      },
    }),
    defineCase({
      name: 'stale expected revision',
      request: (session) => publish(session, sampleReview(0, layerId, stepId)),
      async expect({ response, session, check }) {
        check('status', 409, response.status);
        check(
          'error body',
          apiError(
            409,
            'Conflict',
            'The review changed; reload before retrying',
          ),
          response.body,
        );
        const current = record(
          record(
            (
              await session.send({
                method: 'GET',
                path: worktreePath(session, '/review'),
              })
            ).body,
          ).review,
        );
        check('revision unchanged', 1, current.revision);
      },
    }),
    defineCase({
      name: 'a pointer to a file that does not exist',
      request: (session) =>
        publish(session, sampleReview(1, layerId, stepId, 'missing.md')),
      expect({ response, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'is accepted and located as changed',
          {
            revision: 2,
            layers: [
              {
                steps: [
                  {
                    pointer: { path: 'missing.md' },
                    location: { state: 'changed' },
                  },
                ],
              },
            ],
            notExplained: [
              { path: 'README.md', ranges: [{ startLine: 3, endLine: 3 }] },
            ],
          },
          record(response.body).review,
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        publish(session, { ...sampleReview(2, layerId, stepId), layers: [] }),
        publish(session, {
          ...sampleReview(2, layerId, stepId),
          summaryHtml: '',
        }),
        {
          method: 'PUT',
          path: `/api/worktrees/${unknownWorktreeId}/review`,
          body: sampleReview(0, layerId, stepId),
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.slice(0, 2).entries()) {
          check(`invalid request ${index + 1} status`, 400, response.status);
          check(
            `invalid request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
        check('unknown worktree status', 404, responses[2]?.status);
        check(
          'unknown worktree error body',
          worktreeNotFound,
          responses[2]?.body,
        );
      },
    }),
  ],
});
