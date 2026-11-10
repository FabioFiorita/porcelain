import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import { commitReviewFixture, sampleReview, read } from '../kit/requests.ts';
import { seedReview } from '../kit/seed-review.ts';

test('publishing entry points are absent while mobile can read stored reviews and committed files', async ({
  session,
}) => {
  await commitReviewFixture(session);
  const stored = await seedReview(
    session,
    sampleReview(session, 0, randomUUID(), randomUUID()),
  );
  const reviewId = stored.reviewId;
  const current = await read(session, {
    method: 'GET',
    path: `/api/worktrees/${session.worktreeId}/review`,
  });
  expect(current.review).toMatchObject({ reviewId, revision: 1 });
  expect(
    (await read(session, { method: 'GET', path: `/api/reviews/${reviewId}` }))
      .review,
  ).toMatchObject({ reviewId, latestRevision: 1 });
  expect(
    await read(session, {
      method: 'GET',
      path: `/api/reviews/${reviewId}/revisions/1/file`,
      query: { path: 'README.md' },
    }),
  ).toEqual({
    kind: 'text',
    text: session.fixture.readme.changed,
    blobOid: (await session.git('rev-parse', 'HEAD:README.md')).trim(),
  });
  expect(
    await read(session, {
      method: 'GET',
      path: `/api/reviews/${reviewId}/agent-feedback`,
    }),
  ).toEqual({ currentCommentRevision: 0 });
  const unauthorizedFeedback = await session.send({
    method: 'GET',
    path: `/api/reviews/${reviewId}/agent-feedback`,
    auth: 'none',
  });
  expect(unauthorizedFeedback.status).toBe(401);
  expect(
    (
      await session.send({
        method: 'GET',
        path: `/api/reviews/${reviewId}`,
        auth: 'none',
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await session.send({
        method: 'PUT',
        path: `/api/worktrees/${session.worktreeId}/review`,
        body: {},
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await session.send({
        method: 'POST',
        path: '/mcp',
        target: 'owner',
        body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      })
    ).status,
  ).toBe(404);
});
