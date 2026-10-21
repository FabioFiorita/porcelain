import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import {
  commitReviewFixture,
  read,
  sampleReview,
  toolCall,
  toolValue,
  worktreePath,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, text } from '../kit/session.ts';

test('HTTP deletes a review, is idempotent, and allows a fresh review for the branch', async ({
  session,
}) => {
  await commitReviewFixture(session);
  const path = worktreePath(session, '/review');
  const draft = sampleReview(session, 0, randomUUID(), randomUUID());
  const published = await read(session, { method: 'PUT', path, body: draft });
  const reviewId = text(record(published.review).reviewId);
  expect(record(published.review).revision).toBe(1);
  const remove = () =>
    read(session, { method: 'DELETE', path: `/api/reviews/${reviewId}` });
  expect(await remove()).toEqual({ deleted: true });
  expect(await read(session, { method: 'GET', path })).toEqual({
    review: null,
  });
  expect(
    toolValue(await read(session, toolCall(session, 2, 'read_review', {}))),
  ).toEqual({ review: null, revisions: [], revision: null });
  expect(await remove()).toEqual({ deleted: false });
  const republished = await read(session, { method: 'PUT', path, body: draft });
  expect(record(republished.review).revision).toBe(1);
  expect(record(republished.review).reviewId).not.toBe(reviewId);
});
