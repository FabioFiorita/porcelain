import { randomUUID } from 'node:crypto';
import { listReviewedLayersResponseSchema } from '../../../../packages/contracts/src/reviews/index.ts';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  unknownFingerprint,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  read,
  sampleReview,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const layers = (session: Session) => worktreePath(session, '/reviewed-layers');
const layerId = randomUUID();
const strayLayerId = randomUUID();

async function published(session: Session) {
  const answer = await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(0, layerId, randomUUID()),
  });
  return String(record(list(record(answer.review).layers)[0]).fingerprint);
}

const marks = (body: unknown) =>
  list(record(body).marks).map((mark) => ({
    layerId: record(mark).layerId,
    fingerprint: record(mark).fingerprint,
    stale: record(mark).stale,
  }));

export default defineFeature({
  feature: 'reviews.reviewed-layers',
  reaches: [
    'GET /api/worktrees/:worktreeId/reviewed-layers',
    'PUT /api/worktrees/:worktreeId/reviewed-layers',
    'DELETE /api/worktrees/:worktreeId/reviewed-layers',
  ],
  intent: 'observed',
  behaviour:
    "A reviewer marks layers of the published review as reviewed at the layer fingerprint they saw, and unmarks them; each answer is the worktree's full list of layer marks with whether each is stale. Marks are stored as sent: neither the layer ID nor the fingerprint is checked against the published review.",
  cases: [
    defineCase({
      name: 'mark a published layer',
      setup: published,
      request: (session, fingerprint) => ({
        method: 'PUT',
        path: layers(session),
        body: { layerId, reviewed: true, fingerprint },
      }),
      expect({ response, state, check, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          listReviewedLayersResponseSchema,
          response.body,
        );
        check(
          'marks',
          [{ layerId, fingerprint: state, stale: false }],
          marks(response.body),
        );
      },
    }),
    defineCase({
      name: 'a fingerprint or layer the review does not have',
      request: (session) => [
        {
          method: 'PUT',
          path: layers(session),
          body: { layerId, reviewed: true, fingerprint: unknownFingerprint },
        },
        {
          method: 'PUT',
          path: layers(session),
          body: {
            layerId: strayLayerId,
            reviewed: true,
            fingerprint: unknownFingerprint,
          },
        },
      ],
      expect({ responses, check }) {
        check(
          'statuses',
          [200, 200],
          responses.map((entry) => entry.status),
        );
        check(
          'both are stored and neither is stale',
          [
            { layerId, fingerprint: unknownFingerprint, stale: false },
            {
              layerId: strayLayerId,
              fingerprint: unknownFingerprint,
              stale: false,
            },
          ],
          marks(responses[1]?.body),
        );
      },
    }),
    defineCase({
      name: 'unmark',
      request: (session) => ({
        method: 'DELETE',
        path: layers(session),
        query: { layerId },
      }),
      async expect({ response, session, check }) {
        check('status', 200, response.status);
        check(
          'remaining',
          [strayLayerId],
          marks(response.body).map((mark) => mark.layerId),
        );
        check(
          'list reads the same',
          response.body,
          (await session.send({ method: 'GET', path: layers(session) })).body,
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        {
          method: 'PUT',
          path: layers(session),
          body: {
            layerId: 'not-a-uuid',
            reviewed: true,
            fingerprint: unknownFingerprint,
          },
        },
        {
          method: 'DELETE',
          path: layers(session),
          query: { layerId: 'not-a-uuid' },
        },
        {
          method: 'GET',
          path: `/api/worktrees/${unknownWorktreeId}/reviewed-layers`,
        },
        {
          method: 'PUT',
          path: `/api/worktrees/${unknownWorktreeId}/reviewed-layers`,
          body: { layerId, reviewed: true, fingerprint: unknownFingerprint },
        },
        {
          method: 'DELETE',
          path: `/api/worktrees/${unknownWorktreeId}/reviewed-layers`,
          query: { layerId },
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
        for (const [index, response] of responses.slice(2).entries()) {
          check(
            `unknown worktree request ${index + 1} status`,
            404,
            response.status,
          );
          check(
            `unknown worktree request ${index + 1} error body`,
            worktreeNotFound,
            response.body,
          );
        }
      },
    }),
  ],
});
