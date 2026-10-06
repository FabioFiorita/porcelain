import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { listReviewedLayersResponseSchema } from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownFingerprint,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { eventually, watching } from '../kit/reads.ts';
import { read, sampleReview, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text, type Session } from '../kit/session.ts';

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
const worktreeNotice = (session: Session, change: string) => ({
  type: 'worktree',
  projectId: session.projectId,
  worktreeId: session.worktreeId,
  change,
});
const isWorktree =
  (...changes: string[]) =>
  (notice: Record<string, unknown>) =>
    notice.type === 'worktree' && changes.includes(String(notice.change));

test('marking a layer before any review is published is not found and stores nothing', async ({
  session,
}) => {
  const response = await session.send({
    method: 'PUT',
    path: layers(session),
    body: { layerId, reviewed: true, fingerprint: unknownFingerprint },
  });

  expect(response.status).toBe(404);
  expect(response.body).toStrictEqual(layerNotFound);
  expect(
    marks(await read(session, { method: 'GET', path: layers(session) })),
  ).toStrictEqual([]);
});

test('marking a published layer at its fingerprint answers the mark as not stale', async ({
  session,
}) => {
  const fingerprint = await published(session);

  const response = await session.send({
    method: 'PUT',
    path: layers(session),
    body: { layerId, reviewed: true, fingerprint },
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(listReviewedLayersResponseSchema),
      ),
    ),
  );
  expect(marks(response.body)).toMatchObject([
    { layerId, fingerprint, stale: false },
  ]);
});

test('marking at a fingerprint the layer does not have is a conflict, a layer the review does not have is not found, and the earlier mark is kept', async ({
  session,
}) => {
  const responses = [
    await session.send({
      method: 'PUT',
      path: layers(session),
      body: { layerId, reviewed: true, fingerprint: unknownFingerprint },
    }),
    await session.send({
      method: 'PUT',
      path: layers(session),
      body: {
        layerId: strayLayerId,
        reviewed: true,
        fingerprint: unknownFingerprint,
      },
    }),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([409, 404]);
  expect(responses[0]?.body).toStrictEqual(staleMark);
  expect(responses[1]?.body).toStrictEqual(layerNotFound);
  expect(
    marks(await read(session, { method: 'GET', path: layers(session) })).map(
      (mark) => record(mark).layerId,
    ),
  ).toStrictEqual([layerId]);
});

test('a file change while no viewer watches keeps the layer mark and flags it stale', async ({
  session,
}) => {
  await session.writeFile(
    session.fixture.readme.path,
    'Changed while nobody watched\n',
  );
  await eventually(session, { method: 'GET', path: layers(session) }, (body) =>
    marks(body).some((mark) => record(mark).stale === true),
  ).catch(() => undefined);

  const response = await session.send({ method: 'GET', path: layers(session) });

  expect(response.status).toBe(200);
  expect(marks(response.body)).toMatchObject([{ layerId, stale: true }]);
});

test('a file change while a viewer watches keeps the layer mark and flags it stale', async ({
  session,
}) => {
  const connection = await watching(session);
  await session.writeFile(
    session.fixture.readme.path,
    'Changed while a viewer watched\n',
  );
  await eventually(session, { method: 'GET', path: layers(session) }, (body) =>
    marks(body).some((mark) => record(mark).stale === true),
  ).catch(() => undefined);
  await connection.close();

  const response = await session.send({ method: 'GET', path: layers(session) });

  expect(response.status).toBe(200);
  expect(marks(response.body)).toMatchObject([{ layerId, stale: true }]);
});

test('unmarking a layer answers the remaining marks as the list reads them', async ({
  session,
}) => {
  const response = await session.send({
    method: 'DELETE',
    path: layers(session),
    query: { layerId },
  });

  expect(response.status).toBe(200);
  expect(marks(response.body)).toStrictEqual([]);
  expect(
    await read(session, { method: 'GET', path: layers(session) }),
  ).toStrictEqual(response.body);
});

test('an edit through the API flags the layer mark stale as it answers and tells a watching viewer once that the files changed', async ({
  session,
}) => {
  await session.writeFile(
    session.fixture.readme.path,
    session.fixture.readme.changed,
  );
  const current = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/review'),
  });
  const republished = await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(
      session,
      Number(record(current.review).revision),
      layerId,
      randomUUID(),
    ),
  });
  const fingerprint = String(
    record(list(record(republished.review).layers)[0]).fingerprint,
  );
  await read(session, {
    method: 'PUT',
    path: layers(session),
    body: { layerId, reviewed: true, fingerprint },
  });
  const file = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/text'),
    query: { path: session.fixture.readme.path },
  });
  const contentFingerprint = text(file.contentFingerprint);
  const connection = await watching(session);

  const response = await session.send({
    method: 'POST',
    path: worktreePath(session, '/files'),
    body: {
      kind: 'write',
      path: session.fixture.readme.path,
      text: `${session.fixture.readme.committed}\nEdited through the API.\n`,
      expectedFingerprint: contentFingerprint,
    },
  });

  expect(response.status).toBe(200);
  const written = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/text'),
    query: { path: session.fixture.readme.path },
  });
  expect(response.body).toStrictEqual({
    path: session.fixture.readme.path,
    contentFingerprint: written.contentFingerprint,
  });
  expect(await connection.next(isWorktree('files'))).toStrictEqual(
    worktreeNotice(session, 'files'),
  );
  expect(
    marks(await read(session, { method: 'GET', path: layers(session) })),
  ).toMatchObject([{ layerId, stale: true }]);
  await delay(600);
  await read(session, {
    method: 'DELETE',
    path: layers(session),
    query: { layerId },
  });
  expect(await connection.next(isWorktree('files', 'reviewed'))).toStrictEqual(
    worktreeNotice(session, 'reviewed'),
  );
});

test('marking or unmarking with a malformed layer id is invalid and every layer route of an unknown worktree is not found', async ({
  session,
}) => {
  const responses = [
    await session.send({
      method: 'PUT',
      path: layers(session),
      body: {
        layerId: 'not-a-uuid',
        reviewed: true,
        fingerprint: unknownFingerprint,
      },
    }),
    await session.send({
      method: 'DELETE',
      path: layers(session),
      query: { layerId: 'not-a-uuid' },
    }),
    await session.send({
      method: 'GET',
      path: `/api/worktrees/${unknownWorktreeId}/reviewed-layers`,
    }),
    await session.send({
      method: 'PUT',
      path: `/api/worktrees/${unknownWorktreeId}/reviewed-layers`,
      body: { layerId, reviewed: true, fingerprint: unknownFingerprint },
    }),
    await session.send({
      method: 'DELETE',
      path: `/api/worktrees/${unknownWorktreeId}/reviewed-layers`,
      query: { layerId },
    }),
  ];

  for (const response of responses.slice(0, 2)) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
  for (const response of responses.slice(2)) {
    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual(worktreeNotFound);
  }
});
