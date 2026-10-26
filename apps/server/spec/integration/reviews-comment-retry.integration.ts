import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import {
  commitReviewFixture,
  read,
  sampleReview,
  toolCall,
  toolValue,
} from '../kit/requests.ts';
import { list, record, text } from '../kit/session.ts';

test('stable comment creation retries retain their original revision after republishing', async ({
  session,
}) => {
  await commitReviewFixture(session);
  const draft = sampleReview(session, 0, randomUUID(), randomUUID());
  const call = async (name: string, input: Record<string, unknown>) =>
    toolValue(await read(session, toolCall(session, 1, name, input)));
  const first = record(await call('publish_review', draft));
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
  const saved = record(await call('create_comment', request));
  expect(saved.review).toEqual({ reviewId, revision: 1, headOid });
  await session.writeFile(
    'README.md',
    `${session.fixture.readme.changed}Revision two.\n`,
  );
  await commitReviewFixture(session);
  const second = record(
    await call('publish_review', { ...draft, expectedRevision: 1 }),
  );
  expect(second).toMatchObject({ reviewId, revision: 2 });
  expect(second.headOid).not.toBe(headOid);
  expect(await call('create_comment', request)).toEqual(saved);
  expect(
    await call('create_comment', { ...request, reviewRevision: 1 }),
  ).toEqual(saved);
  const commentsPath = `/api/reviews/${reviewId}/comments`;
  const stored = await session.read({ method: 'GET', path: commentsPath });
  expect(stored.status).toBe(200);
  expect(list(stored.body)).toEqual([saved]);
  for (const changes of [
    { body: 'Changed feedback' },
    { anchor: { ...request.anchor, revision: text(second.headOid) } },
    { messageId: randomUUID() },
  ])
    expect(
      await call('create_comment', { ...request, ...changes }),
    ).toMatchObject({ statusCode: 409 });
  const anotherAuthor = await session.send({
    method: 'POST',
    path: commentsPath,
    body: request,
  });
  expect(anotherAuthor.status).toBe(409);
  const stale = { ...request, threadId: randomUUID(), messageId: randomUUID() };
  expect(await call('create_comment', stale)).toMatchObject({
    statusCode: 400,
  });
  const historical = record(
    await call('create_comment', { ...stale, reviewRevision: 1 }),
  );
  expect(historical.review).toEqual({ reviewId, revision: 1, headOid });
  const current = record(
    await call('create_comment', {
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
