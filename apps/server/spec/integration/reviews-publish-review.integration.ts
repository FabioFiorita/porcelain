import { randomUUID } from 'node:crypto';
import { publishReviewResponseSchema } from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { eventually, inventory } from '../kit/reads.ts';
import {
  SAMPLE_SUMMARY_HTML,
  sampleReview,
  worktreePath,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, type Session } from '../kit/session.ts';

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

test('the first publish resolves each pointer, signs a summary link and marks the worktree review pending', async ({
  session,
}) => {
  const response = await session.send(
    publish(session, sampleReview(session, 0, layerId, stepId)),
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(publishReviewResponseSchema),
  );
  const review = record(record(response.body).review);
  expect(review).toMatchObject({
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
  });
  expect(record(review.summary).url).toMatch(
    /^\/review-summaries\/[0-9a-f-]{36}\?expires=\d{4}-\d{2}-\d{2}T\d{2}%3A\d{2}%3A\d{2}\.\d{3}Z&signature=[A-Za-z0-9_-]{43}$/,
  );
  expect(await worktreeStatus(session)).toBe('pending');
});

test('publishing with a stale expected revision is a conflict and keeps the revision', async ({
  session,
}) => {
  const response = await session.send(
    publish(session, sampleReview(session, 0, layerId, stepId)),
  );

  expect(response.status).toBe(409);
  expect(response.body).toStrictEqual(
    apiError(409, 'Conflict', 'The review changed; reload before retrying'),
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
  expect(current.revision).toBe(1);
});

test('a pointer to a file that does not exist is accepted, located as changed, and leaves the changed line unexplained', async ({
  session,
}) => {
  const response = await session.send(
    publish(
      session,
      sampleReview(session, 1, layerId, stepId, { path: 'missing.md' }),
    ),
  );

  expect(response.status).toBe(200);
  expect(record(response.body).review).toMatchObject({
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
  });
});

test('publishing without layers or without a summary is invalid and to an unknown worktree is not found', async ({
  session,
}) => {
  const noLayers = await session.send(
    publish(session, {
      ...sampleReview(session, 2, layerId, stepId),
      layers: [],
    }),
  );
  const noSummary = await session.send(
    publish(session, {
      ...sampleReview(session, 2, layerId, stepId),
      summaryHtml: '',
    }),
  );
  const unknown = await session.send({
    method: 'PUT',
    path: `/api/worktrees/${unknownWorktreeId}/review`,
    body: sampleReview(session, 0, layerId, stepId),
  });

  expect(noLayers.status).toBe(400);
  expect(noLayers.body).toStrictEqual(invalidRequest);
  expect(noSummary.status).toBe(400);
  expect(noSummary.body).toStrictEqual(invalidRequest);
  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
});

test('once every line the review explains is committed the inventory stops marking the review pending', async ({
  session,
}) => {
  const response = await session.send(
    publish(session, sampleReview(session, 2, layerId, stepId)),
  );

  expect(response.status).toBe(200);
  expect(record(response.body).review).toMatchObject({
    revision: 3,
    active: true,
  });
  expect(await worktreeStatus(session)).toBe('pending');
  await session.git('commit', '-am', 'Commit the readme');
  const settled = await eventually(
    session,
    { method: 'GET', path: '/api/inventory' },
    (body) =>
      record(list(record(list(body.projects)[0]).worktrees)[0]).status !==
      'pending',
  );
  expect(
    record(list(record(list(settled.projects)[0]).worktrees)[0]).status,
  ).toBeNull();
});
