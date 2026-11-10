import { seedReview } from '../kit/seed-review.ts';
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import { commitReviewFixture, sampleReview } from '../kit/requests.ts';
import { list, record, text } from '../kit/session.ts';

test('stable comment creation retries retain their original revision after republishing', async ({
  session,
}) => {
  await commitReviewFixture(session);
  const draft = sampleReview(session, 0, randomUUID(), randomUUID());
  const first = await seedReview(session, draft);
  const create = async (body: object) =>
    await session.send({
      method: 'POST',
      path: `/api/reviews/${first.reviewId}/comments`,
      body,
    });
  const createBody = async (body: object, status = 200) => {
    const response = await create(body);
    expect(response.status).toBe(status);
    return record(response.body);
  };
  const reviewId = text(first.reviewId);
  const headOid = text(first.headOid);
  const request = {
    reviewId,
    threadId: randomUUID(),
    messageId: randomUUID(),
    anchor: {
      kind: 'change',
      comparison: { kind: 'branch', base: 'refs/heads/porcelain-fixture-base' },
      revision: headOid,
    },
    body: 'x'.repeat(16_000),
  };
  const saved = record(await createBody(request));
  expect(saved.review).toEqual({ reviewId, revision: 1, headOid });
  await session.writeFile(
    'README.md',
    `${session.fixture.readme.changed}Revision two.\n`,
  );
  await commitReviewFixture(session);
  const second = record(
    await seedReview(session, { ...draft, expectedRevision: 1 }),
  );
  expect(second).toMatchObject({ reviewId, revision: 2 });
  expect(second.headOid).not.toBe(headOid);
  expect(await createBody(request)).toEqual(saved);
  expect(await createBody({ ...request, reviewRevision: 1 })).toEqual(saved);
  const commentsPath = `/api/reviews/${reviewId}/comments`;
  const stored = await session.read({ method: 'GET', path: commentsPath });
  expect(stored.status).toBe(200);
  expect(list(stored.body)).toEqual([saved]);
  for (const changes of [
    { body: 'Changed feedback' },
    { anchor: { ...request.anchor, revision: text(second.headOid) } },
    { messageId: randomUUID() },
  ])
    expect(await createBody({ ...request, ...changes }, 409)).toMatchObject({
      statusCode: 409,
    });
  const stale = { ...request, threadId: randomUUID(), messageId: randomUUID() };
  expect(await createBody(stale, 400)).toMatchObject({
    statusCode: 400,
  });
  const historical = record(await createBody({ ...stale, reviewRevision: 1 }));
  expect(historical.review).toEqual({ reviewId, revision: 1, headOid });
  const current = record(
    await createBody({
      ...stale,
      threadId: randomUUID(),
      messageId: randomUUID(),
      anchor: { ...request.anchor, revision: text(second.headOid) },
    }),
  );
  expect(current.review).toEqual({
    reviewId,
    revision: 2,
    headOid: second.headOid,
  });
  const final = await session.read({ method: 'GET', path: commentsPath });
  expect(list(final.body)).toEqual([saved, historical, current]);
});
