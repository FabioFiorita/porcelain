import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';

test('old review and worktree discussion routes are absent while walkthrough and reviewed routes stay registered', async ({
  session,
  server,
}) => {
  expect(
    server.routes.some(
      (route) =>
        route.includes('/api/reviews/') ||
        route.includes('/review-summaries/') ||
        route.includes('/comments'),
    ),
  ).toBe(false);
  for (const path of [
    `/api/worktrees/${session.worktreeId}/review`,
    `/api/worktrees/${session.worktreeId}/comments`,
    `/api/reviews/00000000-0000-4000-8000-000000000001`,
  ]) {
    expect((await session.send({ method: 'GET', path })).status, path).toBe(
      404,
    );
  }
  expect(
    (
      await session.send({
        method: 'GET',
        path: `/api/worktrees/${session.worktreeId}/walkthrough`,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await session.send({
        method: 'GET',
        path: `/api/worktrees/${session.worktreeId}/reviewed`,
      })
    ).status,
  ).toBe(200);
});
