import * as Schema from 'effect/Schema';
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
    expect.schemaMatching(
      Schema.toStandardSchemaV1(Schema.toEncoded(publishReviewResponseSchema)),
    ),
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

test('publishing a missing pointer fails with its layer, step, path and lines and keeps the revision', async ({
  session,
}) => {
  const response = await session.send(
    publish(
      session,
      sampleReview(session, 1, layerId, stepId, { path: 'missing.md' }),
    ),
  );
  const pointer = pointerOf(session);
  expect(response.status).toBe(400);
  expect(response.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      `Step \`${stepId}\` in layer \`${layerId}\` points to \`missing.md:${pointer?.startLine}-${pointer?.endLine}\`, which does not exist in this worktree`,
    ),
  );
  const current = await session.read({
    method: 'GET',
    path: worktreePath(session, '/review'),
  });
  expect(record(record(current.body).review).revision).toBe(1);
});

test('publishing unreadable text and out-of-range lines reports the actual pointer failure', async ({
  session,
}) => {
  await session.writeFile('binary.md', '\0binary');
  const draft = sampleReview(session, 1, layerId, stepId, {
    path: 'binary.md',
  });
  const pointer = draft.layers[0]?.steps[0]?.pointer;
  if (!pointer) throw new Error('Sample review has no pointer');
  pointer.startLine = 1;
  pointer.endLine = 1;
  const binary = await session.send(publish(session, draft));
  pointer.path = session.fixture.readme.path;
  pointer.startLine = 100;
  pointer.endLine = 100;
  const range = await session.send(publish(session, draft));
  expect(binary.status).toBe(400);
  expect(binary.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      `Step \`${stepId}\` in layer \`${layerId}\` points to \`binary.md:1-1\`, which is not a readable text file`,
    ),
  );
  expect(range.status).toBe(400);
  expect(range.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      `Step \`${stepId}\` in layer \`${layerId}\` points to \`${session.fixture.readme.path}:100-100\`, but the file has ${session.fixture.readme.changed.trimEnd().split('\n').length} lines`,
    ),
  );
  await session.remove('binary.md');
});

test('publishing without layers or without a summary is invalid and to an unknown worktree is not found', async ({
  session,
}) => {
  const noLayers = await session.send(
    publish(session, {
      ...sampleReview(session, 1, layerId, stepId),
      layers: [],
    }),
  );
  const noSummary = await session.send(
    publish(session, {
      ...sampleReview(session, 1, layerId, stepId),
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
    publish(session, sampleReview(session, 1, layerId, stepId)),
  );

  expect(response.status).toBe(200);
  expect(record(response.body).review).toMatchObject({
    revision: 2,
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
