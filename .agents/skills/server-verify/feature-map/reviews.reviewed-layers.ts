import { randomUUID } from 'node:crypto';
import { listReviewedLayersResponseSchema } from '@porcelain/contracts/reviews';
import {
  apiError,
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
  eventually,
  read,
  sampleReview,
  watching,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const layers = (session: Session) => worktreePath(session, '/reviewed-layers');
const staleMark = apiError(
  409,
  'Conflict',
  'The reviewed mark is based on a version that has changed',
);
const layerNotFound = apiError(404, 'Not Found', 'Review layer not found');
const layerId = randomUUID();
const strayLayerId = randomUUID();

async function published(session: Session) {
  const answer = await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(session, 0, layerId, randomUUID()),
  });
  return String(record(list(record(answer.review).layers)[0]).fingerprint);
}

const marks = (body: unknown) => list(record(body).marks);

export default defineFeature({
  feature: 'reviews.reviewed-layers',
  reaches: [
    'GET /api/worktrees/:worktreeId/reviewed-layers',
    'PUT /api/worktrees/:worktreeId/reviewed-layers',
    'DELETE /api/worktrees/:worktreeId/reviewed-layers',
  ],
  paired: true,
  intent: 'intended',
  behaviour:
    "A reviewer marks layers of the published review as reviewed at the layer fingerprint they saw, and unmarks them; each answer is the worktree's full list of layer marks with whether each is stale. A change to the worktree's files keeps the marks and flags them stale, whether or not a viewer is watching the worktree at the time. A mark is accepted only for a layer of the published review at the fingerprint that layer has now; another fingerprint is a conflict, a layer the published review does not have, or any mark before a review is published, is not found, and neither stores anything.",
  cases: [
    defineCase({
      name: 'before any review is published',
      request: (session) => ({
        method: 'PUT',
        path: layers(session),
        body: { layerId, reviewed: true, fingerprint: unknownFingerprint },
      }),
      async expect({ response, session, check }) {
        check('status', 404, response.status);
        check('error body', layerNotFound, response.body);
        check(
          'nothing is stored',
          [],
          marks(await read(session, { method: 'GET', path: layers(session) })),
        );
      },
    }),
    defineCase({
      name: 'mark a published layer',
      setup: published,
      request: (session, fingerprint) => ({
        method: 'PUT',
        path: layers(session),
        body: { layerId, reviewed: true, fingerprint },
      }),
      expect({ response, state, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          listReviewedLayersResponseSchema,
          response.body,
        );
        checkPartial(
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
      async expect({ responses, session, check }) {
        check(
          'statuses',
          [409, 404],
          responses.map((entry) => entry.status),
        );
        check('request 1 error body', staleMark, responses[0]?.body);
        check('request 2 error body', layerNotFound, responses[1]?.body);
        check(
          'the earlier mark is kept as it was',
          [layerId],
          marks(
            await read(session, { method: 'GET', path: layers(session) }),
          ).map((mark) => record(mark).layerId),
        );
      },
    }),
    defineCase({
      name: 'a change while no viewer watches makes the mark stale',
      async setup(session) {
        await session.writeFile(
          session.fixture.readme.path,
          'Changed while nobody watched\n',
        );
        await eventually(
          session,
          { method: 'GET', path: layers(session) },
          (body) => marks(body).some((mark) => record(mark).stale === true),
        ).catch(() => undefined);
      },
      request: (session) => ({ method: 'GET', path: layers(session) }),
      expect({ response, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'the mark is kept and flagged stale',
          [{ layerId, stale: true }],
          marks(response.body),
        );
      },
    }),
    defineCase({
      name: 'a change while a viewer watches makes the mark stale',
      async setup(session) {
        const connection = await watching(session);
        await session.writeFile(
          session.fixture.readme.path,
          'Changed while a viewer watched\n',
        );
        await eventually(
          session,
          { method: 'GET', path: layers(session) },
          (body) => marks(body).some((mark) => record(mark).stale === true),
        ).catch(() => undefined);
        connection.close();
      },
      request: (session) => ({ method: 'GET', path: layers(session) }),
      expect({ response, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'the mark is kept and flagged stale',
          [{ layerId, stale: true }],
          marks(response.body),
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
        check('remaining', [], marks(response.body));
        check(
          'list reads the same',
          response.body,
          await read(session, { method: 'GET', path: layers(session) }),
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
