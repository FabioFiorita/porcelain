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
import { record, text } from '../kit/session.ts';

test('feedback routes preserve saved comments, enforce paired access and refuse unconnected or inactive recipients', async ({
  session,
}) => {
  await commitReviewFixture(session);
  const published = record(
    toolValue(
      await read(
        session,
        toolCall(
          session,
          1,
          'publish_review',
          sampleReview(session, 0, randomUUID(), randomUUID()),
        ),
      ),
    ),
  );
  const reviewId = text(published.reviewId);
  const path = `/api/reviews/${reviewId}/agent-feedback`;
  const disconnect = `/api/reviews/${reviewId}/agent-session`;
  const comments = `/api/reviews/${reviewId}/comments`;
  const saved = await session.read({
    method: 'POST',
    path: comments,
    body: {
      threadId: randomUUID(),
      messageId: randomUUID(),
      anchor: { kind: 'file', filePath: 'README.md' },
      body: 'Please explain this choice',
    },
  });
  const cursor = record(saved.body).revision;
  expect(saved.status).toBe(200);
  const initial = await session.read({ method: 'GET', path });
  expect(initial.headers['content-type']).toContain('application/json');
  expect(initial.body).toEqual({ currentCommentRevision: cursor });
  expect(
    (await session.send({ method: 'GET', path, auth: 'none' })).status,
  ).toBe(401);
  expect(
    (
      await session.send({
        method: 'POST',
        path,
        auth: 'none',
        body: { reviewRevision: 1 },
      })
    ).status,
  ).toBe(401);
  expect(
    (await session.send({ method: 'DELETE', path: disconnect, auth: 'none' }))
      .status,
  ).toBe(401);
  const absent = await session.read(
    { method: 'POST', path, body: { reviewRevision: 1 } },
    409,
  );
  expect(absent.body).toEqual({
    statusCode: 409,
    error: 'Conflict',
    message: 'Connect a T3 session before sending feedback',
  });
  const call = async (name: string, input: Record<string, unknown>) =>
    toolValue(await read(session, toolCall(session, 2, name, input)));
  expect(
    await call('connect_review_agent', {
      reviewId,
      session: { kind: 't3', threadId: randomUUID() },
    }),
  ).toEqual({
    statusCode: 409,
    error: 'Conflict',
    message:
      'The T3 command is not available to the Porcelain server. Add it to the server’s PATH.',
  });
  expect(
    await call('acknowledge_feedback', { reviewId, deliveryId: randomUUID() }),
  ).toEqual({
    statusCode: 409,
    error: 'Conflict',
    message: 'This feedback delivery is no longer current',
  });
  expect(
    (await session.read({ method: 'DELETE', path: disconnect })).body,
  ).toEqual(initial.body);
  expect((await session.read({ method: 'GET', path: comments })).body).toEqual([
    saved.body,
  ]);
  expect(
    (await session.send({ method: 'POST', path, body: { reviewRevision: 0 } }))
      .status,
  ).toBe(400);
  await session.read({
    method: 'PATCH',
    path: `/api/reviews/${reviewId}`,
    body: { state: 'closed' },
  });
  expect(
    (
      await session.read(
        { method: 'POST', path, body: { reviewRevision: 1 } },
        409,
      )
    ).body,
  ).toEqual({
    statusCode: 409,
    error: 'Conflict',
    message:
      'Open the latest active review before connecting or sending feedback',
  });
});
