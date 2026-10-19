import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import {
  read,
  sampleReview,
  toolCall,
  toolValue,
  worktreePath,
} from '../kit/requests.ts';
import { record, text } from '../kit/session.ts';
import { unknownWorktreeId, worktreeNotFound } from '../kit/answers.ts';

test('HTTP deletes a review, is idempotent, and allows a fresh review for the branch', async ({
  session,
}) => {
  await session.git('add', '-A');
  await session.git('commit', '-m', 'Commit the review fixture');
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

test('deleting an unknown worktree uses the sibling worktree failure', async ({
  session,
}) => {
  const response = await session.send({
    method: 'DELETE',
    path: `/api/worktrees/${unknownWorktreeId}/review`,
  });
  expect(response.status).toBe(404);
  expect(response.body).toEqual(worktreeNotFound);
});
