import { randomUUID } from 'node:crypto';
import { readPublishedReviewResponseSchema } from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import {
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { read, sampleReview, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record } from '../kit/session.ts';

function withoutSummaryUrl(body: unknown) {
  const review = record(record(body).review);
  const summary = Object.fromEntries(
    Object.entries(record(review.summary)).filter(([key]) => key !== 'url'),
  );
  return { ...review, summary };
}

test('reading the review before anything is published answers null', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/review'),
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ review: null });
  expect(response.body).toEqual(
    expect.schemaMatching(readPublishedReviewResponseSchema),
  );
});

test('reading the review after a publish answers it as the publish did with a freshly signed summary link', async ({
  session,
}) => {
  const publishedAnswer = await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(session, 0, randomUUID(), randomUUID()),
  });

  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/review'),
  });

  expect(response.status).toBe(200);
  expect(withoutSummaryUrl(response.body)).toStrictEqual(
    withoutSummaryUrl(publishedAnswer),
  );
  expect(record(record(record(response.body).review).summary).url).toMatch(
    /^\/review-summaries\/[0-9a-f-]{36}\?expires=[^&]+&signature=[A-Za-z0-9_-]{43}$/,
  );
});

test('reading the review of an unknown worktree is not found and of a malformed worktree id is invalid', async ({
  session,
}) => {
  const unknown = await session.send({
    method: 'GET',
    path: `/api/worktrees/${unknownWorktreeId}/review`,
  });
  const malformed = await session.send({
    method: 'GET',
    path: '/api/worktrees/not-an-id/review',
  });

  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
  expect(malformed.status).toBe(400);
  expect(malformed.body).toStrictEqual(invalidRequest);
});
