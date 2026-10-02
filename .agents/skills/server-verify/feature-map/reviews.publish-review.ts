import { randomUUID } from 'node:crypto';
import { publishReviewResponseSchema } from '@porcelain/contracts/reviews';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownWorktreeId,
} from '../scripts/feature.ts';
import {
  list,
  record,
  type Session,
} from '../../../../apps/server/spec/kit/session.ts';
import {
  eventually,
  inventory,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';
import {
  sampleReview,
  SAMPLE_SUMMARY_HTML,
} from '../../../../apps/server/spec/kit/requests.ts';

const layerId = randomUUID();
const stepId = randomUUID();
const publish = (session: Session, body: unknown) => ({
  method: 'PUT' as const,
  path: worktreePath(session, '/review'),
  body,
});
const pointerOf = (session: Session) =>
  sampleReview(session, 0, layerId, stepId).layers[0]?.steps[0]?.pointer;
const worktreeStatus = async (session: Session) =>
  record(
    list(record(list((await inventory(session)).projects)[0]).worktrees)[0],
  ).status;

export default defineFeature({
  feature: 'reviews.publish-review',
  reaches: 'PUT /api/worktrees/:worktreeId/review',
  paired: true,
  intent: 'observed',
  behaviour:
    "An agent or reviewer publishes the worktree's review: an HTML summary, an optional diagram and layers of steps that point at code. Publishing replaces the previous review only if the publisher states the revision it last saw; each publish increments the revision. The server resolves every pointer against the worktree (fingerprinting the text and locating it as current or changed), lists changed lines no step explains, signs a link to the summary, and marks the worktree's review status as pending in the inventory. Once every line the review explains is committed, the inventory stops marking it pending.",
  cases: [
    defineCase({
      name: 'first publish',
      request: (session) =>
        publish(session, sampleReview(session, 0, layerId, stepId)),
      async expect({
        response,
        session,
        check,
        checkPartial,
        checkContract,
        checkMatch,
      }) {
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
            summary: { byteLength: Buffer.byteLength(SAMPLE_SUMMARY_HTML) },
            layers: [
              {
                id: layerId,
                steps: [
                  {
                    id: stepId,
                    pointer: pointerOf(session),
                    location: {
                      state: 'current',
                      startLine: pointerOf(session)?.startLine,
                      endLine: pointerOf(session)?.endLine,
                    },
                  },
                ],
              },
            ],
            notExplained: [],
          },
          review,
        );
        checkMatch(
          'summary link is signed',
          /^\/review-summaries\/[0-9a-f-]{36}\?expires=\d{4}-\d{2}-\d{2}T\d{2}%3A\d{2}%3A\d{2}\.\d{3}Z&signature=[A-Za-z0-9_-]{43}$/,
          record(review.summary).url,
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
      request: (session) =>
        publish(session, sampleReview(session, 0, layerId, stepId)),
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
              await session.read({
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
        publish(
          session,
          sampleReview(session, 1, layerId, stepId, { path: 'missing.md' }),
        ),
      expect({ response, session, check, checkPartial }) {
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
              {
                path: session.fixture.readme.path,
                ranges: [
                  {
                    startLine: pointerOf(session)?.startLine,
                    endLine: pointerOf(session)?.endLine,
                  },
                ],
              },
            ],
          },
          record(response.body).review,
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        publish(session, {
          ...sampleReview(session, 2, layerId, stepId),
          layers: [],
        }),
        publish(session, {
          ...sampleReview(session, 2, layerId, stepId),
          summaryHtml: '',
        }),
        {
          method: 'PUT',
          path: `/api/worktrees/${unknownWorktreeId}/review`,
          body: sampleReview(session, 0, layerId, stepId),
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
    defineCase({
      name: 'the line the review explains is committed',
      request: (session) =>
        publish(session, sampleReview(session, 2, layerId, stepId)),
      async expect({ response, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'published active',
          { revision: 3, active: true },
          record(response.body).review,
        );
        check(
          'worktree review is pending',
          'pending',
          await worktreeStatus(session),
        );
        await session.git('commit', '-am', 'Commit the readme');
        const settled = await eventually(
          session,
          { method: 'GET', path: '/api/inventory' },
          (body) =>
            record(list(record(list(body.projects)[0]).worktrees)[0]).status !==
            'pending',
        );
        check(
          'worktree review is no longer pending',
          null,
          record(list(record(list(settled.projects)[0]).worktrees)[0]).status,
        );
      },
    }),
  ],
});
