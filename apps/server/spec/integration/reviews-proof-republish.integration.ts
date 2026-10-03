import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { apiError, invalidRequest, UNKNOWN_UUID } from '../kit/answers.ts';
import { read, sampleReview, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, type Session } from '../kit/session.ts';

const layerId = randomUUID();
const stepId = randomUUID();
const SHOT_PATH = 'republish-shot.png';
const shot = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const publish = (
  session: Session,
  expectedRevision: number,
  assets: unknown,
) => ({
  method: 'PUT' as const,
  path: worktreePath(session, '/review'),
  body: {
    ...sampleReview(session, expectedRevision, layerId, stepId),
    proof: { assets },
  },
});
const proofFile = (session: Session, proofId: string) => ({
  method: 'GET' as const,
  path: `${worktreePath(session, '/review/proof')}?proofId=${proofId}`,
});
const firstAsset = (body: unknown) =>
  record(list(record(record(record(body).review).proof).assets)[0]);
const publishedId = async (session: Session) =>
  String(
    firstAsset(
      await read(session, {
        method: 'GET',
        path: worktreePath(session, '/review'),
      }),
    ).id,
  );

test('publishing a screenshot keeps it as a PNG of its size', async ({
  session,
}) => {
  await session.writeFile(SHOT_PATH, shot);

  const response = await session.send(
    publish(session, 0, [{ kind: 'image', title: 'Shot', path: SHOT_PATH }]),
  );

  expect(response.status).toBe(200);
  expect(firstAsset(response.body)).toMatchObject({
    kind: 'image',
    mediaType: 'image/png',
    byteLength: shot.byteLength,
  });
});

test('republishing keeps a screenshot by its proof id under a new id after the worktree file is gone', async ({
  session,
}) => {
  await session.remove(SHOT_PATH);
  const proofId = await publishedId(session);

  const response = await session.send(
    publish(session, 1, [
      { kind: 'image', title: 'Same shot', proofId, layerId },
    ]),
  );

  expect(response.status).toBe(200);
  const kept = firstAsset(response.body);
  expect(kept).toMatchObject({
    kind: 'image',
    title: 'Same shot',
    mediaType: 'image/png',
    byteLength: shot.byteLength,
    layerId,
  });
  expect(kept.id).not.toStrictEqual(proofId);
});

test('a kept screenshot reads back as the bytes first published', async ({
  session,
}) => {
  const proofId = await publishedId(session);

  const response = await session.send(proofFile(session, proofId));

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    id: proofId,
    mediaType: 'image/png',
    base64: Buffer.from(shot).toString('base64'),
  });
});

test('keeping an unknown proof id, naming both a path and a proof id, or naming neither is refused and changes nothing', async ({
  session,
}) => {
  const proofId = await publishedId(session);

  const unknown = await session.send(
    publish(session, 2, [
      { kind: 'image', title: 'Shot', proofId: UNKNOWN_UUID },
    ]),
  );
  const both = await session.send(
    publish(session, 2, [
      { kind: 'image', title: 'Shot', proofId, path: SHOT_PATH },
    ]),
  );
  const neither = await session.send(
    publish(session, 2, [{ kind: 'image', title: 'Shot' }]),
  );

  expect(unknown.status).toBe(400);
  expect(unknown.body).toStrictEqual(
    apiError(
      400,
      'Bad Request',
      'A proofId names no image or video of the current review',
    ),
  );
  expect(both.status).toBe(400);
  expect(both.body).toStrictEqual(invalidRequest);
  expect(neither.status).toBe(400);
  expect(neither.body).toStrictEqual(invalidRequest);
  expect(await publishedId(session)).toBe(proofId);
});
